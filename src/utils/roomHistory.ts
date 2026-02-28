/**
 * Room history utility — persists recently joined rooms in localStorage.
 *
 * Privacy notes:
 * - Data is stored **only** on the user's device (localStorage).
 * - No room history is sent to the server.
 * - Users can clear their history at any time via `clearRoomHistory()`.
 */

const STORAGE_KEY = "codesync_recent_rooms";
const MAX_ROOMS = 10;

export type RecentRoom = {
  roomId: string;
  userName: string;
  joinedAt: number; // Unix timestamp (ms)
};

/**
 * Read the current room history from localStorage.
 */
export const getRecentRooms = (): RecentRoom[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Basic shape validation
    return parsed.filter(
      (item): item is RecentRoom =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentRoom).roomId === "string" &&
        typeof (item as RecentRoom).userName === "string" &&
        typeof (item as RecentRoom).joinedAt === "number"
    );
  } catch {
    return [];
  }
};

/**
 * Save a room to history (most-recent first, capped at MAX_ROOMS).
 * If the room already exists, it is moved to the top with updated timestamp.
 */
export const saveRoom = (roomId: string, userName: string): void => {
  try {
    const rooms = getRecentRooms().filter((r) => r.roomId !== roomId);
    rooms.unshift({ roomId, userName, joinedAt: Date.now() });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(rooms.slice(0, MAX_ROOMS))
    );
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded, etc.)
  }
};

/**
 * Remove a single room from history.
 */
export const removeRoom = (roomId: string): void => {
  try {
    const rooms = getRecentRooms().filter((r) => r.roomId !== roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // Silently ignore
  }
};

/**
 * Clear all room history.
 */
export const clearRoomHistory = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore
  }
};
