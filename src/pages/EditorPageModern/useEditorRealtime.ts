import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import type { NavigateFunction } from "react-router-dom";
import { ACTIONS } from "@/utils/constants";
import { saveRoom, updateRoomToken } from "@/utils/roomHistory";
import { initSocket } from "@/utils/socket";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TAB_ID,
  OWNER_PERMISSIONS,
} from "./permissions";
import type {
  Client,
  EditorServerStatus,
  EditorSocket,
  EditorTab,
  TabEditors,
  TabPermissionLevel,
  TabPermissions,
  UserPermissions,
} from "./types";

type UserActiveTab = { username: string; activeTabId: string };

type UseEditorRealtimeOptions = {
  roomId: string | undefined;
  userName: string;
  reclaimToken?: string;
  navigate: NavigateFunction;
  tabsRef: MutableRefObject<EditorTab[]>;
  handleCodeChange: (code: string, tabId: string) => void;
  setTabs: Dispatch<SetStateAction<EditorTab[]>>;
  setActiveTabId: Dispatch<SetStateAction<string>>;
  setUserActiveTabs: Dispatch<SetStateAction<Record<string, string>>>;
  setFollowingUser: Dispatch<SetStateAction<string | null>>;
  setPermissions: Dispatch<SetStateAction<Record<string, UserPermissions>>>;
};

export const useEditorRealtime = ({
  roomId,
  userName,
  reclaimToken,
  navigate,
  tabsRef,
  handleCodeChange,
  setTabs,
  setActiveTabId,
  setUserActiveTabs,
  setFollowingUser,
  setPermissions,
}: UseEditorRealtimeOptions) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [currentEditor, setCurrentEditor] = useState<string>("");
  const [roomCreator, setRoomCreator] = useState<string | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const [serverStatus, setServerStatus] =
    useState<EditorServerStatus>("connecting");
  const [connectionMessage, setConnectionMessage] = useState(
    "Connecting to server...",
  );
  const [tabPermissions, setTabPermissions] = useState<TabPermissions>({});
  const [tabEditors, setTabEditors] = useState<TabEditors>({});
  const [allowEditRequests, setAllowEditRequests] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({}); // tabId -> remaining ms

  // Cooldown countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [tabId, remaining] of Object.entries(prev)) {
          const newVal = remaining - 1000;
          if (newVal > 0) {
            next[tabId] = newVal;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const socketRef = useRef<EditorSocket | null>(null);
  const currentEditorRef = useRef(currentEditor);
  const roomCreatorRef = useRef(roomCreator);
  const handleCodeChangeRef = useRef(handleCodeChange);

  useEffect(() => {
    currentEditorRef.current = currentEditor;
  }, [currentEditor]);

  useEffect(() => {
    roomCreatorRef.current = roomCreator;
  }, [roomCreator]);

  useEffect(() => {
    handleCodeChangeRef.current = handleCodeChange;
  }, [handleCodeChange]);

  const handleErrors = useCallback(() => {
    setServerStatus("disconnected");
    setConnectionMessage("Connection lost - Reconnecting...");
  }, []);

  const emitCurrentEditor = useCallback(
    (nextEditor: string) => {
      socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId,
        currenteditor: nextEditor,
      });
    },
    [roomId],
  );

  const emitTabCreate = useCallback(
    (tabId: string, name: string) => {
      socketRef.current?.emit(ACTIONS.TAB_CREATE, { roomId, tabId, name });
    },
    [roomId],
  );

  const emitTabClose = useCallback(
    (tabId: string) => {
      socketRef.current?.emit(ACTIONS.TAB_CLOSE, { roomId, tabId });
    },
    [roomId],
  );

  const emitTabRename = useCallback(
    (tabId: string, name: string) => {
      socketRef.current?.emit(ACTIONS.TAB_RENAME, { roomId, tabId, name });
    },
    [roomId],
  );

  const emitTabSwitch = useCallback(
    (tabId: string) => {
      socketRef.current?.emit(ACTIONS.TAB_SWITCH, { roomId, tabId });
    },
    [roomId],
  );

  const emitPermissionsUpdate = useCallback(
    (username: string, permissions: UserPermissions) => {
      socketRef.current?.emit(ACTIONS.PERMISSIONS_UPDATE, {
        roomId,
        username,
        permissions,
      });
    },
    [roomId],
  );

  const emitTabPermissionRequest = useCallback(
    (tabId: string) => {
      socketRef.current?.emit(ACTIONS.TAB_PERMISSION_REQUEST, {
        roomId,
        tabId,
      });
    },
    [roomId],
  );

  const emitTabPermissionGrant = useCallback(
    (tabId: string, targetUser: string, level: "EDITOR" | "VIEWER") => {
      socketRef.current?.emit(ACTIONS.TAB_PERMISSION_GRANT, {
        roomId,
        tabId,
        targetUser,
        level,
      });
    },
    [roomId],
  );

  const emitTabPermissionRevoke = useCallback(
    (tabId: string, targetUser: string) => {
      socketRef.current?.emit(ACTIONS.TAB_PERMISSION_REVOKE, {
        roomId,
        tabId,
        targetUser,
      });
    },
    [roomId],
  );

  const emitTransferOwner = useCallback(
    (newOwner: string) => {
      socketRef.current?.emit(ACTIONS.TRANSFER_OWNER, { roomId, newOwner });
    },
    [roomId],
  );

  const emitEditRequestsToggle = useCallback(
    (enabled: boolean) => {
      socketRef.current?.emit(ACTIONS.EDIT_REQUESTS_TOGGLE, {
        roomId,
        enabled,
      });
    },
    [roomId],
  );

  useEffect(() => {
    document.title = `${roomId} - CodeSync`;

    const init = async () => {
      try {
        setServerStatus("connecting");
        setConnectionMessage("Connecting to server...");
        socketRef.current = await initSocket();
        const socket = socketRef.current;
        if (!socket) {
          return;
        }
        setSocketReady(true);

        socket.on("connect", () => {
          setServerStatus("connected");
          setConnectionMessage("Connected!");
        });
        socket.on("connect_error", handleErrors);
        socket.on("connect_failed", handleErrors);
        socket.on("disconnect", () => {
          setServerStatus("disconnected");
          setConnectionMessage("Connection lost - Reconnecting...");
        });

        socket.emit(ACTIONS.JOIN, { roomId, userName, reclaimToken });
        if (roomId) {
          saveRoom(roomId, userName, reclaimToken);
        }

        socket.on(
          ACTIONS.RECLAIM_RESULT,
          (result: { ok: boolean; token?: string | null; owner?: string }) => {
            if (
              result.ok &&
              typeof result.token === "string" &&
              result.token.length > 0 &&
              roomId
            ) {
              // Server verified us as the true owner and issued a fresh token.
              // Persist so we can reclaim again after another disconnect.
              updateRoomToken(roomId, result.token);
            }
            // If `owner` is present, the room is telling everyone the true owner
            // just returned — no extra client action needed beyond UI updates
            // triggered by JOINED/JOIN events.
          },
        );

        socket.on(
          ACTIONS.OWNER_TRANSFERRED,
          ({
            oldOwner,
            newOwner,
            token,
          }: {
            oldOwner: string;
            newOwner: string;
            token?: string;
          }) => {
            setRoomCreator(newOwner);
            setPermissions((prev) => ({
              ...prev,
              [newOwner]: { ...OWNER_PERMISSIONS },
              [oldOwner]: { ...DEFAULT_PERMISSIONS },
            }));
            if (token && roomId) {
              updateRoomToken(roomId, token);
            }
            if (oldOwner === userName) {
              // We were just demoted — drop local edit state.
              setCurrentEditor("");
              setFollowingUser(null);
            }
            toast.success(`Ownership transferred to ${newOwner}`);
          },
        );

        socket.on(
          ACTIONS.JOINED,
          ({ clients: joinedClients, username, roomcreator }) => {
            setClients(joinedClients);
            setRoomCreator(roomcreator);
            if (
              roomCreatorRef.current === username ||
              joinedClients.length === 1
            ) {
              sessionStorage.setItem("admin", username);
            }
            if (username !== userName) {
              toast.success(`${username} joined the room`);
            }
          },
        );

        socket.on(
          ACTIONS.TAB_SYNC,
          ({
            tabs: syncTabs,
            activeTabId: syncActiveTabId,
            userActiveTabs: syncUserActiveTabs,
            permissions: syncPermissions,
            tabPermissions: syncTabPermissions,
            tabEditors: syncTabEditors,
            allowEditRequests: syncAllowEditRequests,
          }: {
            tabs: EditorTab[];
            activeTabId: string;
            userActiveTabs: UserActiveTab[];
            permissions: Record<string, UserPermissions>;
            tabPermissions: TabPermissions;
            tabEditors: TabEditors;
            allowEditRequests: boolean;
          }) => {
            if (syncTabs?.length) {
              setTabs(syncTabs);
              setActiveTabId(
                syncActiveTabId || syncTabs[0]?.id || DEFAULT_TAB_ID,
              );
            }
            if (syncUserActiveTabs) {
              setUserActiveTabs(
                Object.fromEntries(
                  syncUserActiveTabs.map((user) => [
                    user.username,
                    user.activeTabId,
                  ]),
                ),
              );
            }
            if (syncPermissions) {
              setPermissions(syncPermissions);
            }
            if (syncTabPermissions) {
              setTabPermissions(syncTabPermissions);
            }
            if (syncTabEditors) {
              setTabEditors(syncTabEditors);
            }
            if (typeof syncAllowEditRequests === "boolean") {
              setAllowEditRequests(syncAllowEditRequests);
            }
          },
        );

        socket.on(
          ACTIONS.TAB_PERMISSIONS_UPDATE,
          ({
            tabId,
            permissions: tabPerms,
            cooldownMs,
          }: {
            tabId: string;
            permissions: Record<string, TabPermissionLevel>;
            cooldownMs?: number;
          }) => {
            setTabPermissions((prev) => {
              const prevLevel = prev[tabId]?.[userName];
              const newLevel = tabPerms[userName];

              // Detect changes for the current user and provide feedback
              if (prevLevel !== newLevel) {
                if (newLevel === "EDITOR" && prevLevel !== "EDITOR") {
                  toast.success("You now have edit access to this tab! 🎉");
                } else if (newLevel === "REQUESTED") {
                  toast("Edit request sent — waiting for owner", {
                    icon: "🕐",
                  });
                } else if (prevLevel === "EDITOR" && !newLevel) {
                  toast.error("Your edit access to this tab was revoked");
                }
              }

              // Handle cooldown notification
              if (cooldownMs && cooldownMs > 0) {
                setCooldowns((prev) => ({ ...prev, [tabId]: cooldownMs }));
                const minutes = Math.ceil(cooldownMs / 60000);
                toast.error(
                  `Request denied. You can't request again for ${minutes} min.`,
                );
              }

              return {
                ...prev,
                [tabId]: tabPerms,
              };
            });
          },
        );

        socket.on(
          ACTIONS.EDIT_REQUESTS_TOGGLE,
          ({ enabled }: { enabled: boolean }) => {
            setAllowEditRequests(enabled);
          },
        );

        socket.on(ACTIONS.DUPLICATE_USER, ({ username }) => {
          toast.error(
            `${username} is already in the ${roomId} room.\nPlease try another UserName!`,
          );
          navigate("/", { state: { id: roomId } });
        });

        socket.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.success(`${username} left the room`);
          setClients((prev) =>
            prev.filter((client) => client.socketId !== socketId),
          );
          if (currentEditorRef.current === username) {
            setCurrentEditor("");
          }
          setFollowingUser((prev) => (prev === username ? null : prev));
          setUserActiveTabs((prev) => {
            const next = { ...prev };
            delete next[username];
            return next;
          });
        });

        socket.on(
          ACTIONS.SET_CURRENT_EDITOR,
          ({ currenteditor, tabEditors: newTabEditors }) => {
            if (newTabEditors) {
              setTabEditors(newTabEditors);
            }
            if (currenteditor === userName) {
              toast.success("You are now the editor");
            }
            if (currenteditor === "" && userName === roomCreatorRef.current) {
              toast.success(`${currentEditorRef.current} has released control`);
            }
            setCurrentEditor(currenteditor);
          },
        );

        socket.on(ACTIONS.TAB_CREATE, ({ tabId, name }) => {
          setTabs((prev) =>
            prev.some((tab) => tab.id === tabId)
              ? prev
              : [...prev, { id: tabId, name, code: "" }],
          );
        });

        socket.on(ACTIONS.TAB_CLOSE, ({ tabId }) => {
          setTabs((prev) => {
            const filtered = prev.filter((tab) => tab.id !== tabId);
            return filtered.length ? filtered : prev;
          });
          setActiveTabId((prev) => {
            if (prev !== tabId) {
              return prev;
            }
            const nextTabId =
              tabsRef.current.find((tab) => tab.id !== tabId)?.id ||
              DEFAULT_TAB_ID;
            setUserActiveTabs((current) => ({
              ...current,
              [userName]: nextTabId,
            }));
            socket.emit(ACTIONS.TAB_SWITCH, { roomId, tabId: nextTabId });
            return nextTabId;
          });
          // Clean up tab-level permissions for closed tab
          setTabPermissions((prev) => {
            const next = { ...prev };
            delete next[tabId];
            return next;
          });
          setTabEditors((prev) => {
            const next = { ...prev };
            delete next[tabId];
            return next;
          });
        });

        socket.on(ACTIONS.TAB_RENAME, ({ tabId, name }) => {
          setTabs((prev) =>
            prev.map((tab) => (tab.id === tabId ? { ...tab, name } : tab)),
          );
        });

        socket.on(ACTIONS.TAB_CODE, ({ tabId, code }) => {
          handleCodeChangeRef.current(code, tabId);
        });

        socket.on(ACTIONS.TAB_SWITCH, ({ username, tabId }) => {
          setUserActiveTabs((prev) => ({ ...prev, [username]: tabId }));
        });

        socket.on(
          ACTIONS.PERMISSIONS_UPDATE,
          ({ username, permissions: next }) => {
            setPermissions((prev) => ({ ...prev, [username]: next }));
            if (username === userName) {
              toast.success("Your permissions have been updated");
            }
          },
        );
      } catch {
        setServerStatus("disconnected");
        setConnectionMessage("Failed to connect to server");
        toast.error("Failed to connect to server. Please try refreshing.");
      }
    };

    init();

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [
    handleErrors,
    navigate,
    reclaimToken,
    roomId,
    setActiveTabId,
    setFollowingUser,
    setTabs,
    setUserActiveTabs,
    setPermissions,
    tabsRef,
    userName,
  ]);

  return {
    clients,
    connectionMessage,
    currentEditor,
    emitCurrentEditor,
    emitPermissionsUpdate,
    emitTabClose,
    emitTabCreate,
    emitTabRename,
    emitTabSwitch,
    emitTabPermissionGrant,
    emitTabPermissionRequest,
    emitTabPermissionRevoke,
    emitTransferOwner,
    emitEditRequestsToggle,
    roomCreator,
    serverStatus,
    setCurrentEditor,
    socketReady,
    socketRef,
    tabEditors,
    tabPermissions,
    allowEditRequests,
    cooldowns,
  };
};
