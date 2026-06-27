import type { ServerType } from "@hono/node-server";
import type { Socket } from "socket.io";
import { Server as SocketServer } from "socket.io";
import { ACTIONS } from "./actions.js";
import { repo } from "./db/index.js";
import {
	DEFAULT_PERMISSIONS,
	DEFAULT_TAB_ID,
	ROOM_CLEANUP_DELAY_MS,
} from "./db/repository.js";
import type {
	ClientEntry,
	SerializedTab,
	UserActiveTab,
} from "./types.js";

export function setupSocket(
	httpServer: ServerType,
	isAllowedOrigin: (origin: string | undefined) => boolean,
): SocketServer {
	const io = new SocketServer(httpServer, {
		cors: {
			origin: (origin, callback) => {
				if (isAllowedOrigin(origin)) {
					callback(null, true);
				} else {
					callback(new Error("CORS policy: This origin is not allowed"));
				}
			},
			methods: ["GET", "POST"],
			credentials: true,
		},
	});

	// ───────────────────────── Helpers ─────────────────────────
	// Room membership is still enumerated via the Socket.IO adapter (the source
	// of truth for socket lifecycle). Per-socket metadata (username, activeTab)
	// is batch-read from Redis via a pipeline. When horizontal scaling is added,
	// @socket.io/redis-adapter makes this adapter cross-instance transparently.

	const getAllConnectedClients = async (
		roomId: string,
	): Promise<ClientEntry[]> => {
		const socketIds = [...(io.sockets.adapter.rooms.get(roomId) ?? [])];
		if (socketIds.length === 0) return [];
		const usernames = await repo.getSocketUsers(socketIds);
		return socketIds.map((socketId, i) => ({
			socketId,
			username: usernames[i] ?? "",
		}));
	};

	const getUserActiveTabs = async (
		roomId: string,
	): Promise<UserActiveTab[]> => {
		const socketIds = [...(io.sockets.adapter.rooms.get(roomId) ?? [])];
		if (socketIds.length === 0) return [];
		const [usernames, activeTabs] = await Promise.all([
			repo.getSocketUsers(socketIds),
			repo.getSocketActiveTabs(socketIds),
		]);
		return socketIds
			.map((_, i) => ({
				username: usernames[i] ?? "",
				activeTabId: activeTabs[i] ?? DEFAULT_TAB_ID,
			}))
			.filter((u) => u.username !== "");
	};

	const serializeTabs = (
		tabs: Map<string, { name: string; code: string }>,
	): SerializedTab[] =>
		[...tabs.entries()].map(([id, { name, code }]) => ({ id, name, code }));

	const serializePermissions = <T extends Record<string, unknown>>(
		perms: Map<string, T>,
	): Record<string, T> => Object.fromEntries(perms);

	// ───────────────────────── Connection ─────────────────────────

	io.on("connection", (socket: Socket) => {
		// ─────────────── JOIN ───────────────
		socket.on(
			ACTIONS.JOIN,
			async ({ roomId, userName }: { roomId: string; userName: string }) => {
				// 1. Atomic duplicate-user check via SADD on the usernames SET.
				const added = await repo.addRoomUsername(roomId, userName);
				if (!added) {
					socket.emit(ACTIONS.DUPLICATE_USER, { username: userName });
					socket.disconnect();
					return;
				}

				// 2. Write per-socket state before joining the room.
				await Promise.all([
					repo.setSocketUser(socket.id, userName),
					repo.setSocketActiveTab(socket.id, DEFAULT_TAB_ID),
				]);
				void socket.join(roomId);

				// 3. Atomically claim room ownership (SETNX). Returns true for the
				// first joiner, who also gets owner permissions initialized inside
				// the transaction.
				const isCreator = await repo.tryInitRoom(roomId, userName);
				if (!isCreator) {
					// Non-creator: give default permissions (don't clobber existing).
					await repo.setUserPermissionIfNotExists(
						roomId,
						userName,
						DEFAULT_PERMISSIONS,
					);
				}

				// 4. Read back the room state needed for the response payloads.
				const existingClients = await getAllConnectedClients(roomId);
				// Existing clients exclude the joiner (socket.join is async-flushed).
				const allClients: ClientEntry[] = [
					...existingClients.filter((c) => c.socketId !== socket.id),
					{ socketId: socket.id, username: userName },
				];
				const roomCreator = (await repo.getRoomCreator(roomId)) ?? userName;
				const tabs = await repo.getAllRoomTabs(roomId);
				const perms = await repo.getAllRoomPermissions(roomId);
				const userActiveTabs = await getUserActiveTabs(roomId);

				// 5. Notify existing clients that a new user joined.
				for (const { socketId } of allClients) {
					if (socketId === socket.id) continue;
					io.to(socketId).emit(ACTIONS.JOINED, {
						clients: allClients,
						username: userName,
						socketId: socket.id,
						roomcreator: roomCreator,
					});
				}

				// 6. Notify the joining socket itself with room creator info.
				socket.emit(ACTIONS.JOINED, {
					clients: allClients,
					username: userName,
					socketId: socket.id,
					roomcreator: roomCreator,
				});

				// 7. Send the full room snapshot (tabs, active tabs, permissions).
				socket.emit(ACTIONS.TAB_SYNC, {
					tabs: serializeTabs(tabs),
					activeTabId: DEFAULT_TAB_ID,
					userActiveTabs,
					permissions: serializePermissions(perms),
				});

				await repo.refreshRoomTTL(roomId);
			},
		);

		// ─────────────── CODE_CHANGE ───────────────
		socket.on(
			ACTIONS.CODE_CHANGE,
			async ({
				roomId,
				tabId,
				code,
			}: {
				roomId: string;
				tabId: string;
				code: string;
			}) => {
				if (!socket.rooms.has(roomId)) return;

				const userName = await repo.getSocketUser(socket.id);
				if (!userName) return;

				const [roomCreator, userPerms, currentEditor] = await Promise.all([
					repo.getRoomCreator(roomId),
					repo.getUserPermission(roomId, userName),
					repo.getRoomCurrentEditor(roomId),
				]);

				const canEdit = roomCreator === userName || userPerms?.canEdit === true;
				if (!canEdit) return;
				if (roomCreator !== userName && currentEditor !== userName) return;

				// Persist the new code, then broadcast using the freshly-read editor.
				await repo.setTabCode(roomId, tabId, code);
				await repo.refreshRoomTTL(roomId);
				socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {
					tabId,
					code,
					currenteditor: currentEditor,
				});
			},
		);

		// ─────────────── SYNC_CODE ───────────────
		// Relays code to a target socket in a shared room. Reads only Socket.IO
		// internals — no repo state involved. Stays synchronous.
		socket.on(
			ACTIONS.SYNC_CODE,
			({
				socketId,
				code,
				currenteditor,
				tabId,
			}: {
				socketId: string;
				code: string;
				currenteditor: string;
				tabId: string;
			}) => {
				const targetSocket = io.sockets.sockets.get(socketId);
				if (!targetSocket) return;

				const senderRooms = [...socket.rooms].filter((r) => r !== socket.id);
				const hasSharedRoom = senderRooms.some((r) =>
					targetSocket.rooms.has(r),
				);

				if (hasSharedRoom) {
					targetSocket.emit(ACTIONS.CODE_CHANGE, {
						tabId,
						code,
						currenteditor,
					});
				}
			},
		);

		// ─────────────── TAB_CODE_REQUEST ───────────────
		socket.on(
			ACTIONS.TAB_CODE_REQUEST,
			async ({ roomId, tabId }: { roomId: string; tabId: string }) => {
				if (!socket.rooms.has(roomId)) return;
				const tab = await repo.getRoomTab(roomId, tabId);
				if (!tab) return;
				socket.emit(ACTIONS.TAB_CODE, { tabId, code: tab.code });
			},
		);

		// ─────────────── SET_CURRENT_EDITOR ───────────────
		socket.on(
			ACTIONS.SET_CURRENT_EDITOR,
			async ({
				roomId,
				currenteditor,
			}: {
				roomId: string;
				currenteditor: string;
			}) => {
				const userName = await repo.getSocketUser(socket.id);
				if (!userName) return;

				const [roomCreator, currentEditor] = await Promise.all([
					repo.getRoomCreator(roomId),
					repo.getRoomCurrentEditor(roomId),
				]);

				const isOwner = roomCreator === userName;
				const canRelease = currenteditor === "" && currentEditor === userName;
				if (!(isOwner || canRelease)) return;

				await repo.setRoomCurrentEditor(roomId, currenteditor);
				await repo.refreshRoomTTL(roomId);
				socket.in(roomId).emit(ACTIONS.SET_CURRENT_EDITOR, { currenteditor });
			},
		);

		// ─────────────── TAB_CREATE ───────────────
		socket.on(
			ACTIONS.TAB_CREATE,
			async ({
				roomId,
				tabId,
				name,
			}: {
				roomId: string;
				tabId: string;
				name: string;
			}) => {
				const userName = await repo.getSocketUser(socket.id);
				if (!userName) return;

				const [roomCreator, userPerms] = await Promise.all([
					repo.getRoomCreator(roomId),
					repo.getUserPermission(roomId, userName),
				]);
				if (roomCreator !== userName && !userPerms?.canCreateTab) return;

				await repo.createTab(roomId, tabId, name);
				await repo.refreshRoomTTL(roomId);
				io.in(roomId).emit(ACTIONS.TAB_CREATE, { tabId, name });
			},
		);

		// ─────────────── TAB_CLOSE ───────────────
		socket.on(
			ACTIONS.TAB_CLOSE,
			async ({ roomId, tabId }: { roomId: string; tabId: string }) => {
				const userName = await repo.getSocketUser(socket.id);
				if (!userName) return;

				const [roomCreator, userPerms] = await Promise.all([
					repo.getRoomCreator(roomId),
					repo.getUserPermission(roomId, userName),
				]);
				if (roomCreator !== userName && !userPerms?.canDeleteTab) return;

				// Lua-backed: only deletes if more than one tab remains.
				const deleted = await repo.deleteTabIfMultipleTabs(roomId, tabId);
				if (!deleted) return;

				await repo.refreshRoomTTL(roomId);
				io.in(roomId).emit(ACTIONS.TAB_CLOSE, { tabId });
			},
		);

		// ─────────────── TAB_RENAME ───────────────
		socket.on(
			ACTIONS.TAB_RENAME,
			async ({
				roomId,
				tabId,
				name,
			}: {
				roomId: string;
				tabId: string;
				name: string;
			}) => {
				const userName = await repo.getSocketUser(socket.id);
				if (!userName) return;

				const [roomCreator, userPerms] = await Promise.all([
					repo.getRoomCreator(roomId),
					repo.getUserPermission(roomId, userName),
				]);
				if (roomCreator !== userName && !userPerms?.canRenameTab) return;

				await repo.renameTab(roomId, tabId, name);
				await repo.refreshRoomTTL(roomId);
				io.in(roomId).emit(ACTIONS.TAB_RENAME, { tabId, name });
			},
		);

		// ─────────────── TAB_SWITCH ───────────────
		socket.on(
			ACTIONS.TAB_SWITCH,
			async ({ roomId, tabId }: { roomId: string; tabId: string }) => {
				const userName = await repo.getSocketUser(socket.id);
				if (!userName) return;

				await repo.setSocketActiveTab(socket.id, tabId);
				socket.in(roomId).emit(ACTIONS.TAB_SWITCH, {
					username: userName,
					tabId,
				});
			},
		);

		// ─────────────── PERMISSIONS_UPDATE ───────────────
		socket.on(
			ACTIONS.PERMISSIONS_UPDATE,
			async ({
				roomId,
				username,
				permissions,
			}: {
				roomId: string;
				username: string;
				permissions: {
					canEdit: boolean;
					canCreateTab: boolean;
					canDeleteTab: boolean;
					canRenameTab: boolean;
				};
			}) => {
				if (!socket.rooms.has(roomId)) return;

				const userName = await repo.getSocketUser(socket.id);
				if (!userName) return;

				const roomCreator = await repo.getRoomCreator(roomId);
				if (roomCreator !== userName) return;

				await repo.setUserPermission(roomId, username, permissions);
				await repo.refreshRoomTTL(roomId);
				io.in(roomId).emit(ACTIONS.PERMISSIONS_UPDATE, {
					username,
					permissions,
				});
			},
		);

		// ─────────────── disconnecting ───────────────
		socket.on("disconnecting", async () => {
			const rooms = [...socket.rooms].filter((r) => r !== socket.id);
			const userName = await repo.getSocketUser(socket.id);

			// 1. Notify each room that this socket left.
			for (const room of rooms) {
				socket.in(room).emit(ACTIONS.DISCONNECTED, {
					socketId: socket.id,
					username: userName ?? "",
				});
			}

			// 2. If the leaver was the current editor of any room, clear it and
			//    notify the rest of the room.
			if (userName) {
				for (const room of rooms) {
					const currentEditor = await repo.getRoomCurrentEditor(room);
					if (currentEditor === userName) {
						await repo.setRoomCurrentEditor(room, "");
						socket.in(room).emit(ACTIONS.SET_CURRENT_EDITOR, {
							currenteditor: "",
						});
					}
				}
			}

			// 3. Remove per-socket state and room username membership.
			await Promise.all([
				repo.deleteSocketState(socket.id),
				...(userName
					? rooms.map((r) => repo.removeRoomUsername(r, userName))
					: []),
			]);

			// 4. Delayed room cleanup — mirrors the original 500ms behavior so a
			//    quick reconnect doesn't lose state. If the room is empty after
			//    the delay, delete all room-scoped keys explicitly. The 24h TTL is
			//    the safety net if this delete is ever missed.
			for (const room of rooms) {
				setTimeout(() => {
					void (async () => {
						if (!io.sockets.adapter.rooms.get(room)) {
							await repo.deleteRoomState(room);
						}
					})();
				}, ROOM_CLEANUP_DELAY_MS);
			}
		});
	});

	return io;
}
