import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Avatar from "react-avatar";
import toast from "react-hot-toast";
import { FaRegCopy } from "react-icons/fa6";
import { FiEdit2, FiEye, FiLogOut, FiPlus, FiUsers, FiX } from "react-icons/fi";
import { MdTextDecrease, MdTextIncrease } from "react-icons/md";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import AppShell from "@/components/AppShell";
import ClientModern from "@/components/ClientModern";
import EditorWrapper from "@/components/EditorWrapper";
import { Button } from "@/components/ui/button";
import { ACTIONS } from "@/utils/constants";
import { saveRoom } from "@/utils/roomHistory";
import { initSocket } from "@/utils/socket";

type Client = {
  socketId: string;
  username: string;
};

type Tab = {
  id: string;
  name: string;
  code: string;
};

type UserPermissions = {
  canEdit: boolean;
  canCreateTab: boolean;
  canDeleteTab: boolean;
  canRenameTab: boolean;
};

type Socket = {
  // biome-ignore lint/suspicious/noExplicitAny: Socket data can be any shape for real-time events
  emit: (event: string, data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Socket callbacks receive any data structure
  on: (event: string, callback: (data: any) => void) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Socket callbacks receive any data structure
  off: (event: string, callback: (data: any) => void) => void;
  disconnect: () => void;
};

const DEFAULT_TAB_ID = "tab-main";
const DEFAULT_PERMISSIONS: UserPermissions = {
  canEdit: false,
  canCreateTab: false,
  canDeleteTab: false,
  canRenameTab: false,
};

export default function EditorPageModern() {
  const [clients, setClients] = useState<Client[]>([]);
  const [currentEditor, setCurrentEditor] = useState<string>("");
  const currentEditorRef = useRef<string>(currentEditor);
  const [roomCreator, setRoomCreator] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userName = location.state?.userName || "User";

  const [tabs, setTabs] = useState<Tab[]>([
    { id: DEFAULT_TAB_ID, name: "main.js", code: "" },
  ]);
  const [activeTabId, setActiveTabId] = useState(DEFAULT_TAB_ID);
  const tabsRef = useRef(tabs);
  const [userActiveTabs, setUserActiveTabs] = useState<Record<string, string>>(
    {}
  );
  const [followingUser, setFollowingUser] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<"auto" | "manual" | "off">(
    "auto"
  );
  const [permissions, setPermissions] = useState<
    Record<string, UserPermissions>
  >({});
  const [permDialogUser, setPermDialogUser] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [isDark, setIsDark] = useState<boolean>(() =>
    document?.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const [serverStatus, setServerStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [connectionMessage, setConnectionMessage] = useState<string>(
    "Connecting to server..."
  );
  const [fontSize, setFontSize] = useState(16);
  const [wrapLines, setWrapLines] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );
  const [showParticipants, setShowParticipants] = useState<boolean>(false);
  const [zen, setZen] = useState<boolean>(false);

  const isOwner = userName === roomCreator;
  const myPermissions = permissions[userName] || DEFAULT_PERMISSIONS;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const canEditCode =
    isOwner || (userName === currentEditor && myPermissions.canEdit);

  const applyActiveTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      setUserActiveTabs((prev) => ({ ...prev, [userName]: tabId }));
    },
    [userName]
  );

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    currentEditorRef.current = currentEditor;
  }, [currentEditor]);

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) => {
        if (a.username === roomCreator) {
          return -1;
        }
        if (b.username === roomCreator) {
          return 1;
        }
        return 0;
      }),
    [clients, roomCreator]
  );

  const compactAvatars = useMemo(() => {
    const max = 5;
    const slice = sortedClients.slice(0, max);
    const extra = Math.max(0, sortedClients.length - slice.length);
    return { slice, extra };
  }, [sortedClients]);

  const autoFollowTarget = useMemo(() => {
    if (!roomCreator) {
      return null;
    }
    const ownerActive = clients.some(
      (client) => client.username === roomCreator
    );
    if (ownerActive && roomCreator !== userName) {
      return roomCreator;
    }
    if (currentEditor && currentEditor !== userName) {
      return currentEditor;
    }
    return null;
  }, [clients, currentEditor, roomCreator, userName]);

  const getTabName = useCallback(
    (tabId: string) => tabs.find((tab) => tab.id === tabId)?.name || "unknown",
    [tabs]
  );

  const handleErrors = useCallback(() => {
    setServerStatus("disconnected");
    setConnectionMessage("Connection lost - Reconnecting...");
  }, []);

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(id || "");
      toast.success("Room Id copied to clipboard");
    } catch {
      toast.error("Failed to copy Room Id");
    }
  };

  const copyCode = async (): Promise<string | undefined> => {
    try {
      if (!activeTab?.code) {
        toast.error("No code to copy");
        return;
      }
      await navigator.clipboard.writeText(activeTab.code);
      toast.success("Code copied to clipboard");
      return activeTab.code;
    } catch {
      toast.error("Failed to copy code , please try again");
      return;
    }
  };

  const leaveRoom = () => {
    if (sessionStorage.getItem("admin") === roomCreator) {
      sessionStorage.removeItem("admin");
    }
    navigate("/");
  };

  const fontSizeChange = (change: number) => {
    setFontSize((prev) => Math.max(8, Math.min(prev + change, 36)));
  };

  const toggleEditable = (): void => {
    if (currentEditor === userName) {
      setCurrentEditor("");
      toast.success("Editor is now read-only");
      socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: "",
      });
      return;
    }

    if (!isOwner) {
      toast.error("Only the room creator can change the editable state");
      return;
    }

    setCurrentEditor(userName);
    toast.success("Editor is now editable");
    socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, {
      roomId: id,
      currenteditor: userName,
    });
  };

  const handleGrantEditor = (username: string) => {
    setCurrentEditor(username);
    toast.success(`${username} can now edit the code`);
    socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, {
      roomId: id,
      currenteditor: username,
    });
  };

  const handleCreateTab = () => {
    if (!(isOwner || myPermissions.canCreateTab)) {
      toast.error("You don't have permission to create tabs");
      return;
    }
    const tabId = `tab-${uuidv4()}`;
    const name = `file-${tabs.length + 1}.js`;
    setTabs((prev) => [...prev, { id: tabId, name, code: "" }]);
    applyActiveTab(tabId);
    socketRef.current?.emit(ACTIONS.TAB_CREATE, { roomId: id, tabId, name });
    socketRef.current?.emit(ACTIONS.TAB_SWITCH, { roomId: id, tabId });
  };

  const handleCloseTab = (tabId: string) => {
    if (!(isOwner || myPermissions.canDeleteTab)) {
      toast.error("You don't have permission to delete tabs");
      return;
    }
    if (tabs.length <= 1) {
      toast.error("Cannot close the last tab");
      return;
    }
    setTabs((prev) => {
      const filtered = prev.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) {
        const nextActive = filtered[0]?.id || DEFAULT_TAB_ID;
        applyActiveTab(nextActive);
        socketRef.current?.emit(ACTIONS.TAB_SWITCH, {
          roomId: id,
          tabId: nextActive,
        });
      }
      return filtered;
    });
    socketRef.current?.emit(ACTIONS.TAB_CLOSE, { roomId: id, tabId });
  };

  const handleSwitchTab = (tabId: string) => {
    if (tabId === activeTabId) {
      return;
    }
    applyActiveTab(tabId);
    socketRef.current?.emit(ACTIONS.TAB_SWITCH, { roomId: id, tabId });
  };

  const handleRenameTab = (tabId: string, newName: string) => {
    if (!(isOwner || myPermissions.canRenameTab)) {
      toast.error("You don't have permission to rename tabs");
      return;
    }
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, name: trimmed } : tab))
    );
    socketRef.current?.emit(ACTIONS.TAB_RENAME, {
      roomId: id,
      tabId,
      name: trimmed,
    });
    setRenamingTabId(null);
    setRenameValue("");
  };

  const handleCodeChange = useCallback((code: string, tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, code } : tab))
    );
  }, []);

  useEffect(() => {
    if (followMode !== "auto") {
      return;
    }
    setFollowingUser(autoFollowTarget);
  }, [autoFollowTarget, followMode]);

  useEffect(() => {
    const targetTab = followingUser ? userActiveTabs[followingUser] : null;
    if (targetTab && targetTab !== activeTabId) {
      applyActiveTab(targetTab);
      socketRef.current?.emit(ACTIONS.TAB_SWITCH, {
        roomId: id,
        tabId: targetTab,
      });
    }
  }, [activeTabId, applyActiveTab, followingUser, id, userActiveTabs]);

  useEffect(() => {
    if (socketRef.current && id && activeTabId) {
      socketRef.current.emit(ACTIONS.TAB_CODE_REQUEST, {
        roomId: id,
        tabId: activeTabId,
      });
    }
  }, [activeTabId, id]);

  const toggleFollow = (username: string) => {
    if (followingUser === username && followMode === "manual") {
      setFollowMode("off");
      setFollowingUser(null);
      toast.success("Stopped following");
      return;
    }

    setFollowMode("manual");
    setFollowingUser(username);
    toast.success(`Following ${username}`);
    const targetTab = userActiveTabs[username];
    if (targetTab && targetTab !== activeTabId) {
      applyActiveTab(targetTab);
      socketRef.current?.emit(ACTIONS.TAB_SWITCH, {
        roomId: id,
        tabId: targetTab,
      });
    }
  };

  const handleUpdatePermissions = (
    targetUser: string,
    newPermissions: UserPermissions
  ) => {
    if (!isOwner) {
      toast.error("Only the owner can change permissions");
      return;
    }
    setPermissions((prev) => ({ ...prev, [targetUser]: newPermissions }));
    socketRef.current?.emit(ACTIONS.PERMISSIONS_UPDATE, {
      roomId: id,
      username: targetUser,
      permissions: newPermissions,
    });
    toast.success(`Permissions updated for ${targetUser}`);
  };

  useEffect(() => {
    document.title = `${id} - CodeSync`;

    const init = async () => {
      try {
        setServerStatus("connecting");
        setConnectionMessage("Connecting to server...");
        socketRef.current = await initSocket();
        const socket = socketRef.current;
        if (!socket) {
          return;
        }

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

        socket.emit(ACTIONS.JOIN, { roomId: id, userName });
        if (id) {
          saveRoom(id, userName);
        }

        socket.on(
          ACTIONS.JOINED,
          ({ clients: joinedClients, username, socketId, roomcreator }) => {
            setClients(joinedClients);
            setRoomCreator(roomcreator);
            if (
              username === userName &&
              roomcreator === username &&
              sessionStorage.getItem("admin") !== roomcreator &&
              joinedClients.length !== 1
            ) {
              toast.error(
                `${username} is already in the ${id} room.\nPlease try another UserName!`
              );
              navigate("/", { state: { id } });
            }
            if (roomCreator === username || joinedClients.length === 1) {
              sessionStorage.setItem("admin", username);
            }
            if (username !== userName) {
              toast.success(`${username} joined the room`);
              const currentTab = tabsRef.current.find(
                (tab) => tab.id === activeTabId
              );
              if (currentTab) {
                socket.emit(ACTIONS.SYNC_CODE, {
                  socketId,
                  code: currentTab.code,
                  currenteditor: currentEditorRef.current,
                  tabId: activeTabId,
                });
              }
            }
          }
        );

        socket.on(
          ACTIONS.TAB_SYNC,
          ({
            tabs: syncTabs,
            activeTabId: syncActiveTabId,
            userActiveTabs: syncUserActiveTabs,
            permissions: syncPermissions,
          }: {
            tabs: Tab[];
            activeTabId: string;
            userActiveTabs: { username: string; activeTabId: string }[];
            permissions: Record<string, UserPermissions>;
          }) => {
            if (syncTabs?.length) {
              setTabs(syncTabs);
              setActiveTabId(
                syncActiveTabId || syncTabs[0]?.id || DEFAULT_TAB_ID
              );
            }
            if (syncUserActiveTabs) {
              setUserActiveTabs(
                Object.fromEntries(
                  syncUserActiveTabs.map((user) => [
                    user.username,
                    user.activeTabId,
                  ])
                )
              );
            }
            if (syncPermissions) {
              setPermissions(syncPermissions);
            }
          }
        );

        socket.on(ACTIONS.DUPLICATE_USER, ({ username }) => {
          toast.error(
            `${username} is already in the ${id} room.\nPlease try another UserName!`
          );
          navigate("/", { state: { id } });
        });

        socket.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
          toast.success(`${username} left the room`);
          setClients((prev) =>
            prev.filter((client) => client.socketId !== socketId)
          );
          if (currentEditorRef.current === username) {
            setCurrentEditor("");
            socket.emit(ACTIONS.SET_CURRENT_EDITOR, {
              roomId: id,
              currenteditor: "",
            });
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
          if (currenteditor === "" && userName === roomCreator) {
            toast.success(`${currentEditorRef.current} has released control`);
          }
          setCurrentEditor(currenteditor);
        });

        socket.on(ACTIONS.TAB_CREATE, ({ tabId, name }) => {
          setTabs((prev) =>
            prev.some((tab) => tab.id === tabId)
              ? prev
              : [...prev, { id: tabId, name, code: "" }]
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
            socket.emit(ACTIONS.TAB_SWITCH, { roomId: id, tabId: nextTabId });
            return nextTabId;
          });
        });

        socket.on(ACTIONS.TAB_RENAME, ({ tabId, name }) => {
          setTabs((prev) =>
            prev.map((tab) => (tab.id === tabId ? { ...tab, name } : tab))
          );
        });

        socket.on(ACTIONS.TAB_CODE, ({ tabId, code }) => {
          handleCodeChange(code, tabId);
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
          }
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
    };
  }, [
    activeTabId,
    handleCodeChange,
    handleErrors,
    id,
    navigate,
    roomCreator,
    userName,
  ]);

  return (
    <AppShell>
      <div className="flex h-svh min-h-0 flex-col overflow-hidden">
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-2 py-2 sm:px-4">
          {!zen && (
            <div className="mb-2 rounded-lg border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span
                      className={`size-2 rounded-full ${
                        serverStatus === "connected"
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                    />
                    {connectionMessage}
                  </div>
                  <div className="truncate font-mono text-xs sm:text-sm">
                    Room: {id}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {compactAvatars.slice.map((client) => (
                    <Avatar
                      key={client.socketId}
                      name={client.username}
                      round
                      size="28"
                      title={`${client.username} · ${getTabName(
                        userActiveTabs[client.username] || DEFAULT_TAB_ID
                      )}`}
                    />
                  ))}
                  {compactAvatars.extra > 0 && (
                    <span className="rounded-full border px-2 py-1 text-xs">
                      +{compactAvatars.extra}
                    </span>
                  )}
                </div>

                <Button
                  onClick={copyRoomId}
                  size="sm"
                  title="Copy room ID"
                  variant="ghost"
                >
                  <FaRegCopy />
                  <span className="hidden sm:inline">Room</span>
                </Button>
                <Button
                  onClick={copyCode}
                  size="sm"
                  title="Copy active tab code"
                  variant="ghost"
                >
                  <FaRegCopy />
                  <span className="hidden sm:inline">Code</span>
                </Button>
                <Button
                  onClick={toggleEditable}
                  size="sm"
                  variant={canEditCode ? "secondary" : "ghost"}
                >
                  <FiEdit2 />
                  <span className="hidden sm:inline">
                    {canEditCode ? "Editing" : "Read-only"}
                  </span>
                </Button>
                <Button
                  onClick={() => setShowParticipants(true)}
                  size="sm"
                  variant="ghost"
                >
                  <FiUsers />
                  <span className="hidden sm:inline">Users</span>
                </Button>
                <Button
                  onClick={() => fontSizeChange(2)}
                  size="sm"
                  title="Increase text"
                  variant="ghost"
                >
                  <MdTextIncrease />
                </Button>
                <Button
                  onClick={() => fontSizeChange(-2)}
                  size="sm"
                  title="Decrease text"
                  variant="ghost"
                >
                  <MdTextDecrease />
                </Button>
                <Button
                  onClick={() => setWrapLines((value) => !value)}
                  size="sm"
                  variant="ghost"
                >
                  Wrap
                </Button>
                <Button onClick={() => setZen(true)} size="sm" variant="ghost">
                  Zen
                </Button>
                <Button
                  onClick={leaveRoom}
                  size="sm"
                  title="Leave room"
                  variant="destructive"
                >
                  <FiLogOut />
                  <span className="hidden sm:inline">Leave</span>
                </Button>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto px-2 py-1">
                {tabs.map((tab) => (
                  <div
                    className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-sm ${
                      tab.id === activeTabId ? "bg-accent" : "bg-background"
                    }`}
                    key={tab.id}
                  >
                    {renamingTabId === tab.id ? (
                      <input
                        autoFocus
                        className="w-28 bg-transparent outline-none"
                        onBlur={() => handleRenameTab(tab.id, renameValue)}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            handleRenameTab(tab.id, renameValue);
                          }
                          if (event.key === "Escape") {
                            setRenamingTabId(null);
                          }
                        }}
                        value={renameValue}
                      />
                    ) : (
                      <button
                        className="cursor-pointer"
                        onClick={() => handleSwitchTab(tab.id)}
                        onDoubleClick={() => {
                          setRenamingTabId(tab.id);
                          setRenameValue(tab.name);
                        }}
                        type="button"
                      >
                        {tab.name}
                      </button>
                    )}
                    {tabs.length > 1 &&
                      (isOwner || myPermissions.canDeleteTab) && (
                        <button
                          aria-label={`Close ${tab.name}`}
                          className="cursor-pointer rounded hover:bg-destructive/20"
                          onClick={() => handleCloseTab(tab.id)}
                          type="button"
                        >
                          <FiX />
                        </button>
                      )}
                  </div>
                ))}
                {(isOwner || myPermissions.canCreateTab) && (
                  <Button onClick={handleCreateTab} size="sm" variant="ghost">
                    <FiPlus /> New tab
                  </Button>
                )}
                {followingUser && (
                  <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-1 text-primary text-xs">
                    Following {followingUser}:{" "}
                    {getTabName(
                      userActiveTabs[followingUser] || DEFAULT_TAB_ID
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          <section className="relative min-h-0 flex-1 overflow-hidden rounded-lg border bg-card">
            {zen && (
              <button
                aria-label="Exit Zen mode"
                className="absolute top-3 right-3 z-20 rounded-md border bg-background/90 px-2 py-1 text-xs shadow-sm"
                onClick={() => setZen(false)}
                type="button"
              >
                Exit Zen
              </button>
            )}

            {showParticipants && (
              <div
                aria-labelledby="participants-title"
                aria-modal="true"
                className="absolute inset-0 z-50 grid place-items-center p-3"
                role="dialog"
              >
                <div
                  className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                  onClick={() => setShowParticipants(false)}
                />
                <div className="relative z-10 w-full max-w-4xl rounded-lg border bg-card shadow-lg">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2
                      className="font-semibold text-sm"
                      id="participants-title"
                    >
                      Participants ({sortedClients.length})
                    </h2>
                    <Button
                      onClick={() => setShowParticipants(false)}
                      size="sm"
                      variant="ghost"
                    >
                      Close
                    </Button>
                  </div>
                  <div className="max-h-[70svh] overflow-y-auto px-4 py-3">
                    <div className="space-y-2">
                      {sortedClients.map(({ socketId, username }) => {
                        const userPerms =
                          permissions[username] || DEFAULT_PERMISSIONS;
                        return (
                          <div className="space-y-2" key={socketId}>
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <ClientModern
                                  activeTab={getTabName(
                                    userActiveTabs[username] || DEFAULT_TAB_ID
                                  )}
                                  canGrantEdit={isOwner}
                                  currentEditor={currentEditor}
                                  isMe={username === userName}
                                  roomcreator={roomCreator}
                                  username={username}
                                />
                              </div>
                              {username !== userName && (
                                <Button
                                  onClick={() => toggleFollow(username)}
                                  size="sm"
                                  title="Follow this user's active tab"
                                  variant={
                                    followingUser === username
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  <FiEye />
                                </Button>
                              )}
                              {isOwner && username !== roomCreator && (
                                <Button
                                  onClick={() => handleGrantEditor(username)}
                                  size="sm"
                                  variant="outline"
                                >
                                  Edit
                                </Button>
                              )}
                              {isOwner && username !== roomCreator && (
                                <Button
                                  onClick={() =>
                                    setPermDialogUser(
                                      permDialogUser === username
                                        ? null
                                        : username
                                    )
                                  }
                                  size="sm"
                                  variant="outline"
                                >
                                  Perms
                                </Button>
                              )}
                            </div>
                            {permDialogUser === username && (
                              <div className="ml-2 grid gap-2 rounded-md border bg-background p-3 text-sm sm:grid-cols-2">
                                {(
                                  [
                                    ["canEdit", "Edit code"],
                                    ["canCreateTab", "Create tabs"],
                                    ["canDeleteTab", "Delete tabs"],
                                    ["canRenameTab", "Rename tabs"],
                                  ] as const
                                ).map(([key, label]) => (
                                  <label
                                    className="flex items-center gap-2"
                                    key={key}
                                  >
                                    <input
                                      checked={userPerms[key]}
                                      onChange={(event) =>
                                        handleUpdatePermissions(username, {
                                          ...userPerms,
                                          [key]: event.target.checked,
                                        })
                                      }
                                      type="checkbox"
                                    />
                                    {label}
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div
              className={`editor-host h-full w-full ${wrapLines ? "wrap-on" : "no-wrap"}`}
            >
              <EditorWrapper
                activeTabId={activeTab?.id || DEFAULT_TAB_ID}
                currentEditor={currentEditor}
                darkMode={isDark}
                editable={canEditCode}
                fontSize={fontSize}
                initialCode={activeTab?.code || ""}
                onCodeChange={handleCodeChange}
                roomId={id || ""}
                setCurrentEditor={setCurrentEditor}
                socketRef={socketRef as RefObject<Socket>}
                wrap={wrapLines}
              />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
