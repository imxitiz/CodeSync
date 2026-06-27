import type { Redis } from "ioredis";
import { redis } from "./redis.js";
import type { TabData, UserPermissions } from "../types.js";

// TTL safety net (24h). Active rooms refresh this on every write via
// refreshRoomTTL(). Inactive rooms / orphaned keys expire naturally even if
// the explicit delete on last-user-leave is missed (e.g. server crash).
const ROOM_TTL_SECONDS = 86_400;

// Key builders — keep all key construction in one place ("change once").
const socketUserKey = (sid: string): string =>
	`codesync:socket:${sid}:username`;
const socketActiveTabKey = (sid: string): string =>
	`codesync:socket:${sid}:activeTab`;
const roomCreatorKey = (rid: string): string =>
	`codesync:room:${rid}:creator`;
const roomCurrentEditorKey = (rid: string): string =>
	`codesync:room:${rid}:currentEditor`;
const roomTabsKey = (rid: string): string => `codesync:room:${rid}:tabs`;
const roomPermissionsKey = (rid: string): string =>
	`codesync:room:${rid}:permissions`;
const roomUsernamesKey = (rid: string): string =>
	`codesync:room:${rid}:usernames`;

const tabToJson = (tab: TabData): string => JSON.stringify(tab);
const tabFromJson = (raw: string | null): TabData | null => {
	if (raw === null) return null;
	try {
		const parsed = JSON.parse(raw) as TabData;
		return parsed;
	} catch {
		return null;
	}
};

const permsToJson = (perms: UserPermissions): string => JSON.stringify(perms);
const permsFromJson = (raw: string | null): UserPermissions | null => {
	if (raw === null) return null;
	try {
		return JSON.parse(raw) as UserPermissions;
	} catch {
		return null;
	}
};

const allRoomKeys = (rid: string): string[] => [
	roomCreatorKey(rid),
	roomCurrentEditorKey(rid),
	roomTabsKey(rid),
	roomPermissionsKey(rid),
	roomUsernamesKey(rid),
];

export class RoomRepository {
	constructor(private readonly redis: Redis) {}

	// ───────────────────────── Per-socket state ─────────────────────────

	async setSocketUser(socketId: string, username: string): Promise<void> {
		const key = socketUserKey(socketId);
		await this.redis.set(key, username, "EX", ROOM_TTL_SECONDS);
	}

	async getSocketUser(socketId: string): Promise<string | null> {
		return this.redis.get(socketUserKey(socketId));
	}

	async deleteSocketUser(socketId: string): Promise<void> {
		await this.redis.del(socketUserKey(socketId));
	}

	async setSocketActiveTab(socketId: string, tabId: string): Promise<void> {
		const key = socketActiveTabKey(socketId);
		await this.redis.set(key, tabId, "EX", ROOM_TTL_SECONDS);
	}

	async getSocketActiveTab(socketId: string): Promise<string | null> {
		return this.redis.get(socketActiveTabKey(socketId));
	}

	async deleteSocketActiveTab(socketId: string): Promise<void> {
		await this.redis.del(socketActiveTabKey(socketId));
	}

	// Batch reads for getAllConnectedClients / getUserActiveTabs helpers.
	async getSocketUsers(socketIds: string[]): Promise<(string | null)[]> {
		if (socketIds.length === 0) return [];
		const pipeline = this.redis.pipeline();
		for (const sid of socketIds) pipeline.get(socketUserKey(sid));
		const results = await pipeline.exec();
		return (results ?? []).map(([, value]) => value as string | null);
	}

	async getSocketActiveTabs(socketIds: string[]): Promise<(string | null)[]> {
		if (socketIds.length === 0) return [];
		const pipeline = this.redis.pipeline();
		for (const sid of socketIds) pipeline.get(socketActiveTabKey(sid));
		const results = await pipeline.exec();
		return (results ?? []).map(([, value]) => value as string | null);
	}

	// ───────────────────────── Room creator ─────────────────────────

	// Atomically claim room ownership. Returns true if THIS caller became the
	// creator (SETNX returned 1); false if the room already had a creator.
	// On a successful claim, initializes the rest of the room state in a
	// single MULTI/EXEC transaction (default tab, empty editor, usernames set).
	async tryInitRoom(roomId: string, creator: string): Promise<boolean> {
		const claimed = await this.redis.setnx(roomCreatorKey(roomId), creator);
		if (claimed === 0) return false;

		const defaultTab: TabData = { name: DEFAULT_TAB_NAME, code: "" };
		const tabsKey = roomTabsKey(roomId);
		const permsKey = roomPermissionsKey(roomId);
		const editorKey = roomCurrentEditorKey(roomId);
		const usernamesKey = roomUsernamesKey(roomId);
		const creatorKey = roomCreatorKey(roomId);

		const multi = this.redis.multi();
		// Default tab (HSETNX — don't clobber if somehow present).
		multi.hsetnx(tabsKey, DEFAULT_TAB_ID, tabToJson(defaultTab));
		// Owner permissions.
		multi.hsetnx(permsKey, creator, permsToJson(OWNER_PERMISSIONS));
		// Empty current editor.
		multi.set(editorKey, "");
		// Register creator in the usernames set.
		multi.sadd(usernamesKey, creator);
		// TTL on all room keys.
		for (const k of [creatorKey, tabsKey, permsKey, editorKey, usernamesKey]) {
			multi.expire(k, ROOM_TTL_SECONDS);
		}
		await multi.exec();
		return true;
	}

	async getRoomCreator(roomId: string): Promise<string | null> {
		return this.redis.get(roomCreatorKey(roomId));
	}

	async deleteRoomCreator(roomId: string): Promise<void> {
		await this.redis.del(roomCreatorKey(roomId));
	}

	// ───────────────────────── Room current editor ─────────────────────────

	async setRoomCurrentEditor(roomId: string, editor: string): Promise<void> {
		const key = roomCurrentEditorKey(roomId);
		await this.redis.set(key, editor, "EX", ROOM_TTL_SECONDS);
	}

	async getRoomCurrentEditor(roomId: string): Promise<string> {
		const value = await this.redis.get(roomCurrentEditorKey(roomId));
		return value ?? "";
	}

	async deleteRoomCurrentEditor(roomId: string): Promise<void> {
		await this.redis.del(roomCurrentEditorKey(roomId));
	}

	// ───────────────────────── Room tabs (HASH) ─────────────────────────

	// Idempotent default-tab creation. Used on JOIN to ensure a room always
	// has at least one tab. Does NOT overwrite an existing tab-main.
	async ensureDefaultTab(roomId: string): Promise<void> {
		const key = roomTabsKey(roomId);
		const defaultTab: TabData = { name: DEFAULT_TAB_NAME, code: "" };
		await this.redis.hsetnx(key, DEFAULT_TAB_ID, tabToJson(defaultTab));
		await this.redis.expire(key, ROOM_TTL_SECONDS);
	}

	async getAllRoomTabs(roomId: string): Promise<Map<string, TabData>> {
		const raw = await this.redis.hgetall(roomTabsKey(roomId));
		const out = new Map<string, TabData>();
		for (const [tabId, json] of Object.entries(raw)) {
			const tab = tabFromJson(json);
			if (tab) out.set(tabId, tab);
		}
		return out;
	}

	async getRoomTab(roomId: string, tabId: string): Promise<TabData | null> {
		const raw = await this.redis.hget(roomTabsKey(roomId), tabId);
		return tabFromJson(raw);
	}

	async setTabCode(roomId: string, tabId: string, code: string): Promise<void> {
		const key = roomTabsKey(roomId);
		const existing = await this.redis.hget(key, tabId);
		const tab = tabFromJson(existing) ?? { name: tabId, code: "" };
		tab.code = code;
		await this.redis.hset(key, tabId, tabToJson(tab));
	}

	async createTab(roomId: string, tabId: string, name: string): Promise<void> {
		const key = roomTabsKey(roomId);
		const tab: TabData = { name, code: "" };
		await this.redis.hset(key, tabId, tabToJson(tab));
		await this.redis.expire(key, ROOM_TTL_SECONDS);
	}

	async renameTab(roomId: string, tabId: string, name: string): Promise<void> {
		const key = roomTabsKey(roomId);
		const existing = await this.redis.hget(key, tabId);
		const tab = tabFromJson(existing);
		if (!tab) return;
		tab.name = name;
		await this.redis.hset(key, tabId, tabToJson(tab));
	}

	async getRoomTabCount(roomId: string): Promise<number> {
		return this.redis.hlen(roomTabsKey(roomId));
	}

	// Lua-backed: delete a tab only if more than one remains. Returns true if
	// the tab was deleted, false if refused (would leave room tabless).
	async deleteTabIfMultipleTabs(
		roomId: string,
		tabId: string,
	): Promise<boolean> {
		// Command defined on the singleton in redis.ts.
		const result = await (this.redis as unknown as {
			deleteTabIfMultiple: (key: string, tabId: string) => Promise<number>;
		}).deleteTabIfMultiple(roomTabsKey(roomId), tabId);
		return result === 1;
	}

	// ───────────────────────── Room permissions (HASH) ─────────────────────────

	async setUserPermission(
		roomId: string,
		username: string,
		perms: UserPermissions,
	): Promise<void> {
		const key = roomPermissionsKey(roomId);
		await this.redis.hset(key, username, permsToJson(perms));
		await this.redis.expire(key, ROOM_TTL_SECONDS);
	}

	async setUserPermissionIfNotExists(
		roomId: string,
		username: string,
		perms: UserPermissions,
	): Promise<void> {
		await this.redis.hsetnx(
			roomPermissionsKey(roomId),
			username,
			permsToJson(perms),
		);
	}

	async getUserPermission(
		roomId: string,
		username: string,
	): Promise<UserPermissions | null> {
		const raw = await this.redis.hget(roomPermissionsKey(roomId), username);
		return permsFromJson(raw);
	}

	async getAllRoomPermissions(
		roomId: string,
	): Promise<Map<string, UserPermissions>> {
		const raw = await this.redis.hgetall(roomPermissionsKey(roomId));
		const out = new Map<string, UserPermissions>();
		for (const [username, json] of Object.entries(raw)) {
			const perms = permsFromJson(json);
			if (perms) out.set(username, perms);
		}
		return out;
	}

	// ───────────────────────── Room usernames SET (duplicate check) ─────────────────────────

	// Atomic duplicate-user check. Returns true if the username was newly
	// added (SADD returned 1); false if it already existed (duplicate).
	async addRoomUsername(roomId: string, username: string): Promise<boolean> {
		const key = roomUsernamesKey(roomId);
		const added = await this.redis.sadd(key, username);
		await this.redis.expire(key, ROOM_TTL_SECONDS);
		return added === 1;
	}

	async removeRoomUsername(roomId: string, username: string): Promise<void> {
		await this.redis.srem(roomUsernamesKey(roomId), username);
	}

	async getRoomUsernames(roomId: string): Promise<string[]> {
		return this.redis.smembers(roomUsernamesKey(roomId));
	}

	// ───────────────────────── Bulk lifecycle ─────────────────────────

	// Delete ALL room-scoped keys. Called on last-user-leave cleanup.
	async deleteRoomState(roomId: string): Promise<void> {
		await this.redis.del(...allRoomKeys(roomId));
	}

	// Delete both per-socket keys. Called on disconnect.
	async deleteSocketState(socketId: string): Promise<void> {
		await this.redis.del(socketUserKey(socketId), socketActiveTabKey(socketId));
	}

	// Refresh TTL on all room keys. Called from every mutable handler so
	// active rooms stay alive and inactive ones eventually expire.
	async refreshRoomTTL(roomId: string): Promise<void> {
		const pipeline = this.redis.pipeline();
		for (const key of allRoomKeys(roomId)) {
			pipeline.expire(key, ROOM_TTL_SECONDS);
		}
		await pipeline.exec();
	}

	async ping(): Promise<boolean> {
		const reply = await this.redis.ping();
		return reply === "PONG";
	}
}

// Shared constants — kept here so the repo owns them, imported by socket.ts.
export const DEFAULT_TAB_ID = "tab-main";
export const DEFAULT_TAB_NAME = "main.js";
export const DEFAULT_PERMISSIONS: UserPermissions = {
	canEdit: false,
	canCreateTab: false,
	canDeleteTab: false,
	canRenameTab: false,
};
export const OWNER_PERMISSIONS: UserPermissions = {
	canEdit: true,
	canCreateTab: true,
	canDeleteTab: true,
	canRenameTab: true,
};
export const ROOM_CLEANUP_DELAY_MS = 500;

// Singleton repository instance used across the server.
export const repo = new RoomRepository(redis);
