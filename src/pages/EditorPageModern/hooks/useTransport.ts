import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import type { NavigateFunction } from "react-router-dom";
import { ACTIONS } from "../../../utils/constants";
import { saveRoom } from "../../../utils/roomHistory";
import { initSocket } from "../../../utils/socket";
import type {
  Client,
  EditorServerStatus,
  EditorSocket,
  UserPermissions,
  EditorTab,
} from "../types";

type UseTransportOptions = {
  roomId: string | undefined;
  userName: string;
  navigate: NavigateFunction;
  onTabSync: (data: { 
    tabs: EditorTab[]; 
    activeTabId: string; 
    userActiveTabs: { username: string; activeTabId: string }[];
    permissions: Record<string, UserPermissions>;
  }) => void;
  onTabCreate: (data: { tabId: string; name: string }) => void;
  onTabClose: (data: { tabId: string }) => void;
  onTabRename: (data: { tabId: string; name: string }) => void;
  onTabCode: (data: { tabId: string; code: string }) => void;
  onTabSwitch: (data: { username: string; tabId: string }) => void;
  onPermissionsUpdate: (data: { username: string; permissions: UserPermissions }) => void;
  onCodeChange: (data: { tabId: string; code: string; currenteditor: string }) => void;
};

export const useTransport = ({
  roomId,
  userName,
  navigate,
  onTabSync,
  onTabCreate,
  onTabClose,
  onTabRename,
  onTabCode,
  onTabSwitch,
  onPermissionsUpdate,
  onCodeChange,
}: UseTransportOptions) => {
  const [socketReady, setSocketReady] = useState(false);
  const [serverStatus, setServerStatus] = useState<EditorServerStatus>("connecting");
  const [connectionMessage, setConnectionMessage] = useState("Connecting to server...");
  const [clients, setClients] = useState<Client[]>([]);
  const [roomCreator, setRoomCreator] = useState<string | null>(null);
  const [currentEditor, setCurrentEditor] = useState<string>("");
  
  const socketRef = useRef<EditorSocket | null>(null);
  const userNameRef = useRef(userName);
  const roomIdRef = useRef(roomId);

  useEffect(() => {
    userNameRef.current = userName;
    roomIdRef.current = roomId;
  }, [userName, roomId]);

  // Use refs for callbacks to avoid effect re-runs
  const callbacks = useRef({
    onTabSync,
    onTabCreate,
    onTabClose,
    onTabRename,
    onTabCode,
    onTabSwitch,
    onPermissionsUpdate,
    onCodeChange,
  });

  useEffect(() => {
    callbacks.current = {
      onTabSync,
      onTabCreate,
      onTabClose,
      onTabRename,
      onTabCode,
      onTabSwitch,
      onPermissionsUpdate,
      onCodeChange,
    };
  }, [onTabSync, onTabCreate, onTabClose, onTabRename, onTabCode, onTabSwitch, onPermissionsUpdate, onCodeChange]);

  const handleErrors = useCallback(() => {
    setServerStatus("disconnected");
    setConnectionMessage("Connection lost - Reconnecting...");
  }, []);

  const emitCurrentEditor = useCallback((nextEditor: string) => {
    socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, { roomId: roomIdRef.current, currenteditor: nextEditor });
  }, []);

  const emitTabCreate = useCallback((tabId: string, name: string) => {
    socketRef.current?.emit(ACTIONS.TAB_CREATE, { roomId: roomIdRef.current, tabId, name });
  }, []);

  const emitTabClose = useCallback((tabId: string) => {
    socketRef.current?.emit(ACTIONS.TAB_CLOSE, { roomId: roomIdRef.current, tabId });
  }, []);

  const emitTabRename = useCallback((tabId: string, name: string) => {
    socketRef.current?.emit(ACTIONS.TAB_RENAME, { roomId: roomIdRef.current, tabId, name });
  }, []);

  const emitTabSwitch = useCallback((tabId: string) => {
    socketRef.current?.emit(ACTIONS.TAB_SWITCH, { roomId: roomIdRef.current, tabId });
  }, []);

  const emitPermissionsUpdate = useCallback((targetUser: string, permissions: UserPermissions) => {
    socketRef.current?.emit(ACTIONS.PERMISSIONS_UPDATE, { roomId: roomIdRef.current, username: targetUser, permissions });
  }, []);

  const emitTabCodeRequest = useCallback((tabId: string) => {
    socketRef.current?.emit(ACTIONS.TAB_CODE_REQUEST, { roomId: roomIdRef.current, tabId });
  }, []);

  const emitCodeChange = useCallback((tabId: string, code: string) => {
      socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId: roomIdRef.current, tabId, code });
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setServerStatus("connecting");
        setConnectionMessage("Connecting to server...");
        socketRef.current = await initSocket();
        const socket = socketRef.current;
        if (!socket) return;
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

        socket.emit(ACTIONS.JOIN, { roomId: roomIdRef.current, userName: userNameRef.current });
        if (roomIdRef.current) saveRoom(roomIdRef.current, userNameRef.current);

        socket.on(ACTIONS.JOINED, ({ clients: joinedClients, roomcreator, username: joinedUser }) => {
          setClients(joinedClients);
          setRoomCreator(roomcreator);
          if (joinedUser !== userNameRef.current) {
            toast.success(`${joinedUser} joined`);
          }
        });

        socket.on(ACTIONS.TAB_SYNC, (data) => {
          callbacks.current.onTabSync?.(data);
        });

        socket.on(ACTIONS.DUPLICATE_USER, ({ username }) => {
          toast.error(`${username} is already in the ${roomIdRef.current} room.\nPlease try another UserName!`);
          navigate("/", { state: { id: roomIdRef.current } });
        });

        socket.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.success(`${username} left`);
          setClients(prev => prev.filter(c => c.socketId !== socketId));
        });

        socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ currenteditor }) => {
          setCurrentEditor(currenteditor);
        });

        socket.on(ACTIONS.TAB_CREATE, (data) => {
          callbacks.current.onTabCreate?.(data);
        });

        socket.on(ACTIONS.TAB_CLOSE, (data) => {
          callbacks.current.onTabClose?.(data);
        });

        socket.on(ACTIONS.TAB_RENAME, (data) => {
          callbacks.current.onTabRename?.(data);
        });

        socket.on(ACTIONS.TAB_CODE, (data) => {
          callbacks.current.onTabCode?.(data);
        });

        socket.on(ACTIONS.TAB_SWITCH, (data) => {
          callbacks.current.onTabSwitch?.(data);
        });

        socket.on(ACTIONS.PERMISSIONS_UPDATE, (data) => {
          callbacks.current.onPermissionsUpdate?.(data);
        });

        socket.on(ACTIONS.CODE_CHANGE, (data) => {
            callbacks.current.onCodeChange?.(data);
        });

      } catch (err) {
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
  }, [navigate, handleErrors]);

  return {
    socketRef,
    socketReady,
    serverStatus,
    connectionMessage,
    clients,
    roomCreator,
    currentEditor,
    emitCurrentEditor,
    emitTabCreate,
    emitTabClose,
    emitTabRename,
    emitTabSwitch,
    emitPermissionsUpdate,
    emitTabCodeRequest,
    emitCodeChange,
    setCurrentEditor,
  };
};
