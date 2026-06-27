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
import { saveRoom } from "@/utils/roomHistory";
import { initSocket } from "@/utils/socket";
import { DEFAULT_TAB_ID } from "./permissions";
import type {
  Client,
  EditorServerStatus,
  EditorSocket,
  EditorTab,
  UserPermissions,
} from "./types";

type UserActiveTab = { username: string; activeTabId: string };

type UseEditorRealtimeOptions = {
  roomId: string | undefined;
  userName: string;
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

        socket.emit(ACTIONS.JOIN, { roomId, userName });
        if (roomId) {
          saveRoom(roomId, userName);
        }

        socket.on(
          ACTIONS.JOINED,
          ({ clients: joinedClients, username, roomcreator }) => {
            setClients(joinedClients);
            setRoomCreator(roomcreator);
            if (
              username === userName &&
              roomcreator === username &&
              sessionStorage.getItem("admin") !== roomcreator &&
              joinedClients.length !== 1
            ) {
              toast.error(
                `${username} is already in the ${roomId} room.\nPlease try another UserName!`,
              );
              navigate("/", { state: { id: roomId } });
            }
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
          }: {
            tabs: EditorTab[];
            activeTabId: string;
            userActiveTabs: UserActiveTab[];
            permissions: Record<string, UserPermissions>;
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

        socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ currenteditor }) => {
          if (currenteditor === userName) {
            toast.success("You are now the editor");
          }
          if (currenteditor === "" && userName === roomCreatorRef.current) {
            toast.success(`${currentEditorRef.current} has released control`);
          }
          setCurrentEditor(currenteditor);
        });

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
    roomCreator,
    serverStatus,
    setCurrentEditor,
    socketReady,
    socketRef,
  };
};
