import { describe, expect, it } from "bun:test";
import {
  createRoomState,
  destroyRoomState,
  disconnectClient,
  joinRoom,
  transferOwner,
} from "../roomManager";

const SECRET = "test-secret-dev-only";
const ROOM = "room-abc";

describe("joinRoom — first joiner becomes owner", () => {
  it("first joiner is the creator", () => {
    const room = createRoomState(ROOM);
    const result = joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    expect(result.ok).toBe(true);
    expect(room.creator).toBe("alice");
    expect(room.createdAt).toBe(1000);
    expect(room.clients.length).toBe(1);
    expect(result.freshToken).toBeTruthy();
  });

  it("first joiner gets OWNER_PERMISSIONS", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    expect(room.permissions.get("alice")).toEqual({
      canEdit: true,
      canCreateTab: true,
      canDeleteTab: true,
      canRenameTab: true,
    });
  });

  it("second joiner is NOT the creator", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const result2 = joinRoom(room, "s2", "bob", SECRET, undefined, 1001);
    expect(result2.ok).toBe(true);
    expect(room.creator).toBe("alice");
    expect(result2.freshToken).toBeNull();
  });

  it("second joiner gets DEFAULT_PERMISSIONS", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    joinRoom(room, "s2", "bob", SECRET, undefined, 1001);
    expect(room.permissions.get("bob")).toEqual({
      canEdit: false,
      canCreateTab: false,
      canDeleteTab: false,
      canRenameTab: false,
    });
  });
});

describe("joinRoom — duplicate username", () => {
  it("rejects duplicate non-owner username", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const result = joinRoom(room, "s2", "alice", SECRET, undefined, 1001);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("duplicate-username");
  });

  it("rejects duplicate when attacker tries owner name without token", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    disconnectClient(room, "s1");
    const result = joinRoom(room, "s2", "alice", SECRET, undefined, 2000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("duplicate-username");
    expect(room.creator).toBe("alice");
  });
});

describe("joinRoom — owner reclaim after disconnect", () => {
  it("owner can reclaim with valid token after disconnect", () => {
    const room = createRoomState(ROOM);
    const r1 = joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const token = r1.freshToken!;
    disconnectClient(room, "s1");
    expect(room.clients.length).toBe(0);
    expect(room.creator).toBe("alice");
    const r2 = joinRoom(room, "s2", "alice", SECRET, token, 2000);
    expect(r2.ok).toBe(true);
    expect(r2.reclaimOk).toBe(true);
    expect(room.creator).toBe("alice");
    expect(room.clients.length).toBe(1);
    expect(room.clients[0]?.socketId).toBe("s2");
    expect(r2.freshToken).toBeTruthy();
  });

  it("owner can reclaim even if another user joined while they were away", () => {
    const room = createRoomState(ROOM);
    const r1 = joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const token = r1.freshToken!;
    disconnectClient(room, "s1");
    joinRoom(room, "s2", "bob", SECRET, undefined, 1500);
    const r3 = joinRoom(room, "s3", "alice", SECRET, token, 2000);
    expect(r3.ok).toBe(true);
    expect(room.creator).toBe("alice");
    expect(room.clients.some((c) => c.username === "bob")).toBe(true);
  });

  it("reclaim fails with expired token (outside 30-min window)", () => {
    const room = createRoomState(ROOM);
    const r1 = joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const token = r1.freshToken!;
    disconnectClient(room, "s1");
    const r2 = joinRoom(
      room,
      "s2",
      "alice",
      SECRET,
      token,
      1000 + 31 * 60 * 1000
    );
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("duplicate-username");
  });

  it("reclaim fails with tampered token", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    disconnectClient(room, "s1");
    const r2 = joinRoom(room, "s2", "alice", SECRET, "tampered.token", 2000);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("duplicate-username");
  });

  it("reclaim fails with wrong secret", () => {
    const room = createRoomState(ROOM);
    const r1 = joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const token = r1.freshToken!;
    disconnectClient(room, "s1");
    const r2 = joinRoom(room, "s2", "alice", "wrong-secret", token, 2000);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("duplicate-username");
  });

  it("token from room A cannot grant ownership of room B", () => {
    const roomA = createRoomState("room-a");
    const roomB = createRoomState("room-b");
    const r1 = joinRoom(roomA, "s1", "alice", SECRET, undefined, 1000);
    const tokenA = r1.freshToken!;
    const r2 = joinRoom(roomB, "s2", "alice", SECRET, tokenA, 1100);
    // The user may join room B as a participant, but must NOT become owner.
    expect(r2.ok).toBe(true);
    expect(roomB.creator).not.toBe("alice");
    expect(r2.freshToken).toBeNull();
  });
});

describe("joinRoom — owner re-same-socket (page refresh simulation)", () => {
  it("owner with valid token can rejoin even if old socket is still connected", () => {
    const room = createRoomState(ROOM);
    const r1 = joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const token = r1.freshToken!;
    const r2 = joinRoom(room, "s2", "alice", SECRET, token, 1100);
    expect(r2.ok).toBe(true);
    expect(room.creator).toBe("alice");
    expect(room.clients.some((c) => c.socketId === "s1")).toBe(false);
    expect(room.clients.some((c) => c.socketId === "s2")).toBe(true);
  });
});

describe("transferOwner", () => {
  it("transfers ownership to another participant", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    joinRoom(room, "s2", "bob", SECRET, undefined, 1001);
    const result = transferOwner(room, "s1", "bob", SECRET, 2000);
    expect(result.ok).toBe(true);
    expect(room.creator).toBe("bob");
    expect(room.permissions.get("bob")?.canEdit).toBe(true);
    expect(room.permissions.get("alice")?.canEdit).toBe(false);
    expect(result.freshToken).toBeTruthy();
  });

  it("rejects transfer from non-owner", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    joinRoom(room, "s2", "bob", SECRET, undefined, 1001);
    const result = transferOwner(room, "s2", "alice", SECRET, 2000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not-owner");
    expect(room.creator).toBe("alice");
  });

  it("rejects transfer to user not in room", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const result = transferOwner(room, "s1", "charlie", SECRET, 2000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("target-not-in-room");
  });

  it("releases editor when old owner was editing", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    joinRoom(room, "s2", "bob", SECRET, undefined, 1001);
    room.currentEditor = "alice";
    transferOwner(room, "s1", "bob", SECRET, 2000);
    expect(room.currentEditor).toBe("");
  });
});

describe("disconnectClient", () => {
  it("removes client and flags owner-has-disconnected", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    const { room: r, wasOwner } = disconnectClient(room, "s1");
    expect(wasOwner).toBe(true);
    expect(r.clients.length).toBe(0);
    expect(r.ownerHasDisconnected).toBe(true);
    expect(r.creator).toBe("alice");
  });

  it("removes non-owner without flagging", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    joinRoom(room, "s2", "bob", SECRET, undefined, 1001);
    const { room: r, wasOwner } = disconnectClient(room, "s2");
    expect(wasOwner).toBe(false);
    expect(r.clients.length).toBe(1);
    expect(r.ownerHasDisconnected).toBe(false);
  });

  it("clears editor if disconnecting user was editing", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    room.currentEditor = "alice";
    const { room: r } = disconnectClient(room, "s1");
    expect(r.currentEditor).toBe("");
  });
});

describe("destroyRoomState", () => {
  it("resets all room state", () => {
    const room = createRoomState(ROOM);
    joinRoom(room, "s1", "alice", SECRET, undefined, 1000);
    joinRoom(room, "s2", "bob", SECRET, undefined, 1001);
    destroyRoomState(room);
    expect(room.clients.length).toBe(0);
    expect(room.creator).toBeNull();
    expect(room.createdAt).toBeNull();
    expect(room.ownerHasDisconnected).toBe(false);
    expect(room.permissions.size).toBe(0);
    expect(room.currentEditor).toBe("");
  });
});
