import { describe, expect, it } from "bun:test";
import {
  signReclaimToken,
  verifyReclaimToken,
} from "../reclaim";

const SECRET = "test-secret-dev-only";
const ROOM = "room-abc";
const USER = "alice";

describe("signReclaimToken / verifyReclaimToken", () => {
  it("round-trips a valid token", () => {
    const token = signReclaimToken(SECRET, {
      roomId: ROOM,
      userName: USER,
      joinTs: 1_000_000,
      v: 1,
    });
    const result = verifyReclaimToken(SECRET, token, ROOM, USER, 1_000_000);
    expect(result.valid).toBe(true);
    expect(result.joinTs).toBe(1_000_000);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signReclaimToken("other-secret", {
      roomId: ROOM,
      userName: USER,
      joinTs: 1_000_000,
      v: 1,
    });
    const result = verifyReclaimToken(SECRET, token, ROOM, USER, 1_000_000);
    expect(result.valid).toBe(false);
  });

  it("rejects a token bound to a different room", () => {
    const token = signReclaimToken(SECRET, {
      roomId: "room-xyz",
      userName: USER,
      joinTs: 1_000_000,
      v: 1,
    });
    const result = verifyReclaimToken(SECRET, token, ROOM, USER, 1_000_000);
    expect(result.valid).toBe(false);
  });

  it("rejects a token bound to a different username", () => {
    const token = signReclaimToken(SECRET, {
      roomId: ROOM,
      userName: "bob",
      joinTs: 1_000_000,
      v: 1,
    });
    const result = verifyReclaimToken(SECRET, token, ROOM, USER, 1_000_000);
    expect(result.valid).toBe(false);
  });

  it("rejects a token past the reclaim window", () => {
    const old = Date.now() - 31 * 60 * 1000; // 31 min ago
    const token = signReclaimToken(SECRET, {
      roomId: ROOM,
      userName: USER,
      joinTs: old,
      v: 1,
    });
    const result = verifyReclaimToken(SECRET, token, ROOM, USER, Date.now());
    expect(result.valid).toBe(false);
  });

  it("rejects a token with a future joinTs", () => {
    const future = Date.now() + 60_000;
    const token = signReclaimToken(SECRET, {
      roomId: ROOM,
      userName: USER,
      joinTs: future,
      v: 1,
    });
    const result = verifyReclaimToken(SECRET, token, ROOM, USER, Date.now());
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed token", () => {
    const result = verifyReclaimToken(SECRET, "not-a-jwt", ROOM, USER, Date.now());
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const token = signReclaimToken(SECRET, {
      roomId: ROOM,
      userName: USER,
      joinTs: 1_000_000,
      v: 1,
    });
    // Flip a single character in the payload segment.
    const tampered =
      (token.startsWith("a") ? "b" : "a") + token.slice(1);
    const result = verifyReclaimToken(SECRET, tampered, ROOM, USER, 1_000_000);
    expect(result.valid).toBe(false);
  });
});
