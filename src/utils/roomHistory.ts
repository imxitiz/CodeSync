/**
 * Room history utility — persists recently joined rooms in localStorage.
 *
 * Privacy notes:
 * - Data is stored **only** on the user's device (localStorage).
 * - No room history is sent to the server.
 * - Reclaim tokens are opaque HMAC-signed blobs — they cannot be forged or
 *   tampered with, and they are bound to a specific room + username + time.
 * - Users can clear their history or disable it entirely.
 */

const STORAGE_KEY = "codesync_recent_rooms";
const HISTORY_ENABLED_KEY = "codesync_recent_rooms_enabled";
const MAX_ROOMS = 8;

export type RecentRoom = {
  roomId: string;
  userName: string;
  joinedAt: number;
  reclaimToken?: string;
};

const hasLocalStorage = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
};

export const isRoomHistoryEnabled = (): boolean => {
  if (!hasLocalStorage()) {
    return false;
  }
  try {
    return localStorage.getItem(HISTORY_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
};

export const setRoomHistoryEnabled = (enabled: boolean): void => {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    localStorage.setItem(HISTORY_ENABLED_KEY, String(enabled));
    if (!enabled) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
};

const isRecentRoom = (item: unknown): item is RecentRoom => {
  if (typeof item !== "object" || item === null) {
    return false;
  }
  const r = item as Record<string, unknown>;
  return (
    typeof r.roomId === "string" &&
    typeof r.userName === "string" &&
    typeof r.joinedAt === "number" &&
    (r.reclaimToken === undefined || typeof r.reclaimToken === "string")
  );
};

export const getRecentRooms = (): RecentRoom[] => {
  if (!isRoomHistoryEnabled()) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isRecentRoom).slice(0, MAX_ROOMS);
  } catch {
    return [];
  }
};

export const saveRoom = (
  roomId: string,
  userName: string,
  reclaimToken?: string,
): void => {
  if (!isRoomHistoryEnabled()) {
    return;
  }
  try {
    const rooms = getRecentRooms().filter((room) => room.roomId !== roomId);
    const next: RecentRoom = {
      roomId,
      userName,
      joinedAt: Date.now(),
    };
    if (typeof reclaimToken === "string" && reclaimToken.length > 0) {
      next.reclaimToken = reclaimToken;
    }
    rooms.unshift(next);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(rooms.slice(0, MAX_ROOMS)),
    );
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
};

export const updateRoomToken = (roomId: string, reclaimToken: string): void => {
  if (!isRoomHistoryEnabled()) {
    return;
  }
  try {
    const rooms = getRecentRooms();
    const idx = rooms.findIndex((r) => r.roomId === roomId);
    if (idx === -1) {
      return;
    }
    const existing = rooms[idx];
    if (!existing) {
      return;
    }
    rooms[idx] = { ...existing, reclaimToken };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // ignore
  }
};

export const removeRoom = (roomId: string): void => {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    const rooms = getRecentRooms().filter((room) => room.roomId !== roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // Silently ignore storage failures.
  }
};

export const clearRoomHistory = (): void => {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore storage failures.
  }
};
