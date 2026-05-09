import {
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
import type {
  Client,
  EditorServerStatus,
  EditorSocket,
  UserPermissions,
} from "./types";

type UseTransportOptions = {
  roomId: string | undefined;
  userName: string;
  navigate: NavigateFunction;
  onJoined?: (data: { clients: Client[]; roomcreator: string; username: string }) => void;
  onTabSync?: (data: any) => void;
  onDisconnected?: (data: { socketId: string; username: string }) => void;
  onCurrentEditorChange?: (currenteditor: string) => void;
  onTabCreate?: (data: { tabId: string; name: string }) => void;
  onTabClose?: (data: { tabId: string }) => void;
  onTabRename?: (data: { tabId: string; name: string }) => void;
  onTabCode?: (data: { tabId: string; code: string }) => void;
  onTabSwitch?: (data: { username: string; tabId: string }) => void;
  onPermissionsUpdate?: (data: { username: string; permissions: UserPermissions }) => void;
};

export const useTransport = ({
  roomId,
  userName,
  navigate,
  onJoined,
  onTabSync,
  onDisconnected,
  onCurrentEditorChange,
  onTabCreate,
  onTabClose,
  onTabRename,
  onTabCode,
  onTabSwitch,
  onPermissionsUpdate,
}: UseTransportOptions) => {
  const [socketReady, setSocketReady] = useState(false);
  const [serverStatus, setServerStatus] = useState<EditorServerStatus>("connecting");
  const [connectionMessage, setConnectionMessage] = useState("Connecting to server...");
  const socketRef = useRef<EditorSocket | null>(null);

  // Use refs for callbacks to avoid effect re-runs on every render
  const callbacks = useRef({
    onJoined,
    onTabSync,
    onDisconnected,
    onCurrentEditorChange,
    onTabCreate,
    onTabClose,
    onTabRename,
    onTabCode,
    onTabSwitch,
    onPermissionsUpdate,
  });

  useEffect(() => {
    callbacks.current = {
      onJoined,
      onTabSync,
      onDisconnected,
      onCurrentEditorChange,
      onTabCreate,
      onTabClose,
      onTabRename,
      onTabCode,
      onTabSwitch,
      onPermissionsUpdate,
    };
  });

  const handleErrors = useCallback(() => {
    setServerStatus("disconnected");
    setConnectionMessage("Connection lost - Reconnecting...");
  }, []);

  const emitCurrentEditor = useCallback((nextEditor: string) => {
    socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, { roomId, currenteditor: nextEditor });
  }, [roomId]);

  const emitTabCreate = useCallback((tabId: string, name: string) => {
    socketRef.current?.emit(ACTIONS.TAB_CREATE, { roomId, tabId, name });
  }, [roomId]);

  const emitTabClose = useCallback((tabId: string) => {
    socketRef.current?.emit(ACTIONS.TAB_CLOSE, { roomId, tabId });
  }, [roomId]);

  const emitTabRename = useCallback((tabId: string, name: string) => {
    socketRef.current?.emit(ACTIONS.TAB_RENAME, { roomId, tabId, name });
  }, [roomId]);

  const emitTabSwitch = useCallback((tabId: string) => {
    socketRef.current?.emit(ACTIONS.TAB_SWITCH, { roomId, tabId });
  }, [roomId]);

  const emitPermissionsUpdate = useCallback((targetUser: string, permissions: UserPermissions) => {
    socketRef.current?.emit(ACTIONS.PERMISSIONS_UPDATE, { roomId, username: targetUser, permissions });
  }, [roomId]);

  const emitTabCodeRequest = useCallback((tabId: string) => {
    socketRef.current?.emit(ACTIONS.TAB_CODE_REQUEST, { roomId, tabId });
  }, [roomId]);

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

        socket.emit(ACTIONS.JOIN, { roomId, userName });
        if (roomId) saveRoom(roomId, userName);

        socket.on(ACTIONS.JOINED, (data) => {
          callbacks.current.onJoined?.(data);
        });

        socket.on(ACTIONS.TAB_SYNC, (data) => {
          callbacks.current.onTabSync?.(data);
        });

        socket.on(ACTIONS.DUPLICATE_USER, ({ username }) => {
          toast.error(`${username} is already in the ${roomId} room.\nPlease try another UserName!`);
          navigate("/", { state: { id: roomId } });
        });

        socket.on(ACTIONS.DISCONNECTED, (data) => {
          callbacks.current.onDisconnected?.(data);
        });

        socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ currenteditor }) => {
          callbacks.current.onCurrentEditorChange?.(currenteditor);
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
  }, [roomId, userName, navigate, handleErrors]);

  return {
    socketRef,
    socketReady,
    serverStatus,
    connectionMessage,
    emitCurrentEditor,
    emitTabCreate,
    emitTabClose,
    emitTabRename,
    emitTabSwitch,
    emitPermissionsUpdate,
    emitTabCodeRequest,
  };
};
