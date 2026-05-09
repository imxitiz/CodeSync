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
import {
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiInfo,
  FiLogOut,
  FiPlus,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { MdTextDecrease, MdTextIncrease } from "react-icons/md";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import AppShell from "../../components/AppShell";
import EditorWrapper from "../../components/EditorWrapper";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TAB_ID,
  canShowTabPermissionControls,
} from "./permissions";
import type { Client, EditorSocket, EditorTab } from "./types";
import { usePermissions } from "./usePermissions";
import { useTransport } from "./useTransport";

export default function EditorPageModern() {
  const [clients, setClients] = useState<Client[]>([]);
  const [currentEditor, setCurrentEditor] = useState<string>("");
  const [roomCreator, setRoomCreator] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userName = location.state?.userName || "User";

  const [tabs, setTabs] = useState<EditorTab[]>([
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
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const [fontSize, setFontSize] = useState(16);
  const [wrapLines, setWrapLines] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < 640
  );
  const [showParticipants, setShowParticipants] = useState<boolean>(false);
  const [zen, setZen] = useState<boolean>(false);

  const handleCodeChange = useCallback((code: string, tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, code } : tab))
    );
  }, []);

  const {
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
  } = useTransport({
    roomId: id,
    userName,
    navigate,
    onJoined: ({ clients: joinedClients, roomcreator, username }) => {
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
      if (roomcreator === username || joinedClients.length === 1) {
        sessionStorage.setItem("admin", username);
      }
      if (username !== userName) {
        toast.success(`${username} joined the room`);
      }
    },
    onTabSync: ({
      tabs: syncTabs,
      activeTabId: syncActiveTabId,
      userActiveTabs: syncUserActiveTabs,
      permissions: syncPermissions,
    }) => {
      if (syncTabs?.length) {
        setTabs(syncTabs);
        setActiveTabId(syncActiveTabId || syncTabs[0]?.id || DEFAULT_TAB_ID);
      }
      if (syncUserActiveTabs) {
        setUserActiveTabs(
          Object.fromEntries(
            syncUserActiveTabs.map(
              (user: { username: string; activeTabId: string }) => [
                user.username,
                user.activeTabId,
              ]
            )
          )
        );
      }
      if (syncPermissions) {
        setPermissions(syncPermissions);
      }
    },
    onDisconnected: ({ username, socketId }) => {
      toast.success(`${username} left the room`);
      setClients((prev) =>
        prev.filter((client) => client.socketId !== socketId)
      );
      if (currentEditor === username) {
        setCurrentEditor("");
      }
      setFollowingUser((prev) => (prev === username ? null : prev));
      setUserActiveTabs((prev) => {
        const next = { ...prev };
        delete next[username];
        return next;
      });
    },
    onCurrentEditorChange: (currenteditor) => {
      if (currenteditor === userName) {
        toast.success("You are now the editor");
      }
      if (currenteditor === "" && userName === roomCreator) {
        toast.success(`${currentEditor} has released control`);
      }
      setCurrentEditor(currenteditor);
    },
    onTabCreate: ({ tabId, name }) => {
      setTabs((prev) =>
        prev.some((tab) => tab.id === tabId)
          ? prev
          : [...prev, { id: tabId, name, code: "" }]
      );
    },
    onTabClose: ({ tabId }) => {
      setTabs((prev) => {
        const filtered = prev.filter((tab) => tab.id !== tabId);
        return filtered.length ? filtered : prev;
      });
      setActiveTabId((prev) => {
        if (prev !== tabId) return prev;
        const nextTabId =
          tabsRef.current.find((tab) => tab.id !== tabId)?.id || DEFAULT_TAB_ID;
        setUserActiveTabs((current) => ({
          ...current,
          [userName]: nextTabId,
        }));
        emitTabSwitch(nextTabId);
        return nextTabId;
      });
    },
    onTabRename: ({ tabId, name }) => {
      setTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, name } : tab))
      );
    },
    onTabCode: ({ tabId, code }) => {
      handleCodeChange(code, tabId);
    },
    onTabSwitch: ({ username, tabId }) => {
      setUserActiveTabs((prev) => ({ ...prev, [username]: tabId }));
    },
    onPermissionsUpdate: ({ username, permissions: next }) => {
      setPermissions((prev) => ({ ...prev, [username]: next }));
      if (username === userName) {
        toast.success("Your permissions have been updated");
      }
    },
  });

  const {
    permissions,
    setPermissions,
    updatePermissions,
    grantEditor,
    takeControl,
  } = usePermissions(id, roomCreator, emitPermissionsUpdate, emitCurrentEditor);

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

  const sortedClients = useMemo(
    () =>
      [...clients].sort((a, b) => {
        if (a.username === roomCreator) return -1;
        if (b.username === roomCreator) return 1;
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
    if (!roomCreator) return null;
    const ownerActive = clients.some(
      (client) => client.username === roomCreator
    );
    if (ownerActive && roomCreator !== userName) return roomCreator;
    if (currentEditor && currentEditor !== userName) return currentEditor;
    return null;
  }, [clients, currentEditor, roomCreator, userName]);

  const getTabName = useCallback(
    (tabId: string) => tabs.find((tab) => tab.id === tabId)?.name || "unknown",
    [tabs]
  );

  const activeFollowerTabName = followingUser
    ? getTabName(userActiveTabs[followingUser] || DEFAULT_TAB_ID)
    : null;

  let roleLabel = "Viewer";
  if (isOwner) roleLabel = "Owner";
  else if (canEditCode) roleLabel = "Editor";

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
      emitCurrentEditor("");
      return;
    }

    if (!isOwner) {
      toast.error("Only the room creator can change the editable state");
      return;
    }

    takeControl(userName);
    toast.success("Editor is now editable");
  };

  const handleCreateTab = useCallback(() => {
    if (!(isOwner || myPermissions.canCreateTab)) {
      toast.error("You don't have permission to create tabs");
      return;
    }
    const tabId = `tab-${uuidv4()}`;
    const name = `file-${tabs.length + 1}.js`;
    setTabs((prev) => [...prev, { id: tabId, name, code: "" }]);
    applyActiveTab(tabId);
    emitTabCreate(tabId, name);
    emitTabSwitch(tabId);
  }, [
    applyActiveTab,
    emitTabCreate,
    emitTabSwitch,
    isOwner,
    myPermissions.canCreateTab,
    tabs.length,
  ]);

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
        emitTabSwitch(nextActive);
      }
      return filtered;
    });
    emitTabClose(tabId);
  };

  const stopFollowing = () => {
    setFollowMode("off");
    setFollowingUser(null);
    toast.success("Follow mode is off");
  };

  const handleSwitchTab = (tabId: string) => {
    if (tabId === activeTabId) return;
    if (followingUser) {
      toast(
        `You're following ${followingUser}. Turn off follow mode to switch tabs manually.`
      );
      return;
    }
    applyActiveTab(tabId);
    emitTabSwitch(tabId);
  };

  const switchTabByOffset = useCallback(
    (offset: number) => {
      if (followingUser) {
        toast(
          `You're following ${followingUser}. Turn off follow mode to switch tabs manually.`
        );
        return;
      }
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTabId);
      if (currentIndex === -1 || tabs.length <= 1) return;
      const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      if (!nextTab) return;
      applyActiveTab(nextTab.id);
      emitTabSwitch(nextTab.id);
    },
    [activeTabId, applyActiveTab, followingUser, tabs, emitTabSwitch]
  );

  const handleRenameTab = (tabId: string, newName: string) => {
    if (!(isOwner || myPermissions.canRenameTab)) {
      toast.error("You don't have permission to rename tabs");
      return;
    }
    const trimmed = newName.trim();
    if (!trimmed) return;
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, name: trimmed } : tab))
    );
    emitTabRename(tabId, trimmed);
    setRenamingTabId(null);
    setRenameValue("");
  };

  useEffect(() => {
    if (followMode !== "auto") return;
    setFollowingUser(autoFollowTarget);
  }, [autoFollowTarget, followMode]);

  useEffect(() => {
    const targetTab = followingUser ? userActiveTabs[followingUser] : null;
    if (targetTab && targetTab !== activeTabId) {
      applyActiveTab(targetTab);
      emitTabSwitch(targetTab);
    }
  }, [activeTabId, applyActiveTab, followingUser, userActiveTabs, emitTabSwitch]);

  useEffect(() => {
    if (socketReady && id && activeTabId) {
      emitTabCodeRequest(activeTabId);
    }
  }, [activeTabId, id, socketReady, emitTabCodeRequest]);

  const toggleFollow = (username: string) => {
    if (followingUser === username && followMode === "manual") {
      stopFollowing();
      return;
    }

    setFollowMode("manual");
    setFollowingUser(username);
    toast.success(`Following ${username}`);
    const targetTab = userActiveTabs[username];
    if (targetTab && targetTab !== activeTabId) {
      applyActiveTab(targetTab);
      emitTabSwitch(targetTab);
    }
  };

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (!(event.altKey && event.shiftKey)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        switchTabByOffset(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        switchTabByOffset(-1);
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        handleCreateTab();
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [switchTabByOffset, handleCreateTab]);

  return (
    <AppShell className="overflow-hidden">
      <div className="h-full min-h-0 overflow-hidden bg-background p-2 sm:p-3">
        <section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="shrink-0 border-b bg-card/95 backdrop-blur">
            {!zen && (
              <div className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        serverStatus === "connected"
                          ? "bg-primary"
                          : "bg-muted-foreground"
                      )}
                    />
                    <span>{connectionMessage}</span>
                    <span className="hidden text-muted-foreground/60 sm:inline">
                      · {roleLabel}
                    </span>
                  </div>
                  <div className="truncate font-mono text-xs sm:text-sm">
                    {id}
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

                <div className="flex items-center gap-1">
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
                    title={
                      canEditCode
                        ? "You can edit in this room"
                        : "Only the owner or granted editor can edit"
                    }
                    variant={canEditCode ? "secondary" : "ghost"}
                  >
                    <FiEdit2 />
                    <span className="hidden sm:inline">
                      {canEditCode ? "Editing" : "View"}
                    </span>
                  </Button>
                  <Button
                    onClick={() => setShowParticipants(true)}
                    size="sm"
                    variant="ghost"
                  >
                    <FiUsers />
                    <span className="hidden sm:inline">People</span>
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
                    title="Toggle line wrap"
                    variant={wrapLines ? "secondary" : "ghost"}
                  >
                    Wrap
                  </Button>
                  <Button
                    onClick={() => setZen(true)}
                    size="sm"
                    title="Hide editor chrome"
                    variant="ghost"
                  >
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
              </div>
            )}

            <div
              className={cn(
                "flex min-h-10 items-end gap-1 overflow-x-auto px-2 pt-1",
                zen && "px-4"
              )}
            >
              {tabs.map((tab) => {
                const isActiveTab = tab.id === activeTabId;
                const isFollowingLocked = Boolean(
                  followingUser && !isActiveTab
                );
                return (
                  <div
                    className={cn(
                      "group flex shrink-0 items-center gap-1 rounded-t-lg border px-2 py-1.5 text-sm transition-colors",
                      isActiveTab
                        ? "border-b-card bg-card text-foreground"
                        : "border-transparent bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      isFollowingLocked && "cursor-not-allowed opacity-60"
                    )}
                    key={tab.id}
                    title={
                      isFollowingLocked
                        ? `Following ${followingUser}. Turn off follow to switch tabs.`
                        : "Click to switch · double click to rename"
                    }
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
                        className={cn(
                          "cursor-pointer truncate",
                          isFollowingLocked && "cursor-not-allowed"
                        )}
                        onClick={() => handleSwitchTab(tab.id)}
                        onDoubleClick={() => {
                          if (followingUser) {
                            toast(
                              `You're following ${followingUser}. Turn off follow to rename tabs.`
                            );
                            return;
                          }
                          setRenamingTabId(tab.id);
                          setRenameValue(tab.name);
                        }}
                        type="button"
                      >
                        {tab.name}
                      </button>
                    )}
                    {tabs.length > 1 && (isOwner || myPermissions.canDeleteTab) && (
                      <button
                        aria-label={`Close ${tab.name}`}
                        className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-70 transition hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                        onClick={() => handleCloseTab(tab.id)}
                        type="button"
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                );
              })}
              {(isOwner || myPermissions.canCreateTab) && (
                <button
                  className="mb-1 inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs transition hover:bg-accent hover:text-accent-foreground"
                  onClick={handleCreateTab}
                  title="New tab · Alt+Shift+N"
                  type="button"
                >
                  <FiPlus /> New
                </button>
              )}
              <div className="ml-auto hidden shrink-0 items-center gap-1 pb-1 text-[11px] text-muted-foreground lg:flex">
                <span>Alt+Shift+←/→</span>
                <span className="text-muted-foreground/50">switch tabs</span>
              </div>
            </div>
          </div>

          {followingUser && (
            <div className="absolute top-24 right-3 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border bg-popover/95 px-3 py-1.5 text-popover-foreground text-xs shadow-sm backdrop-blur sm:top-20">
              <FiInfo className="shrink-0" />
              <span className="truncate">
                Following {followingUser}
                {activeFollowerTabName ? ` · ${activeFollowerTabName}` : ""}
              </span>
              <button
                className="cursor-pointer rounded-full px-2 py-0.5 text-primary hover:bg-accent"
                onClick={stopFollowing}
                type="button"
              >
                Turn off
              </button>
            </div>
          )}

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
              className="absolute inset-0 z-50"
              role="dialog"
            >
              <div
                className="absolute inset-0 bg-background/55 backdrop-blur-sm"
                onClick={() => setShowParticipants(false)}
              />
              <aside className="absolute inset-x-2 top-2 bottom-2 flex flex-col overflow-hidden rounded-xl border bg-popover/95 text-popover-foreground shadow-2xl backdrop-blur md:inset-x-auto md:right-2 md:w-[28rem]">
                <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                  <div>
                    <h2
                      className="font-semibold text-sm"
                      id="participants-title"
                    >
                      People in this room
                    </h2>
                    <p className="text-muted-foreground text-xs">
                      Follow activity, hand off editing, or tune permissions.
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowParticipants(false)}
                    size="sm"
                    variant="ghost"
                  >
                    Close
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                  <div className="space-y-1.5">
                    {sortedClients.map(({ socketId, username }) => {
                      const userPerms =
                        permissions[username] || DEFAULT_PERMISSIONS;
                      const isMe = username === userName;
                      const isParticipantOwner = username === roomCreator;
                      const isParticipantEditor = username === currentEditor;
                      const participantTabName = getTabName(
                        userActiveTabs[username] || DEFAULT_TAB_ID
                      );
                      return (
                        <div
                          className="rounded-lg px-2 py-2 transition-colors hover:bg-accent/50"
                          key={socketId}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar name={username} round size="36" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="truncate font-medium text-sm">
                                  {username}
                                </span>
                                {isMe && (
                                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
                                    You
                                  </span>
                                )}
                                {isParticipantOwner && (
                                  <span className="rounded-full border px-1.5 py-0.5 text-[11px]">
                                    Owner
                                  </span>
                                )}
                                {isParticipantEditor && (
                                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px]">
                                    Editing
                                  </span>
                                )}
                              </div>
                              <p className="truncate text-muted-foreground text-xs">
                                On {participantTabName}
                              </p>
                            </div>
                            {!isMe && (
                              <button
                                className={cn(
                                  "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-xs transition",
                                  followingUser === username
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent"
                                )}
                                onClick={() => toggleFollow(username)}
                                title={
                                  followingUser === username
                                    ? `Stop following ${username}`
                                    : `Follow ${username}'s active tab`
                                }
                                type="button"
                              >
                                {followingUser === username ? (
                                  <FiEyeOff />
                                ) : (
                                  <FiEye />
                                )}
                                {followingUser === username
                                  ? "Following"
                                  : "Follow"}
                              </button>
                            )}
                          </div>

                          {isOwner && !isParticipantOwner && (
                            <div className="mt-2 flex flex-wrap items-center gap-1 pl-12">
                              {!userPerms.canEdit && (
                                <button
                                  className="cursor-pointer rounded-full border px-2 py-1 text-xs transition hover:bg-accent"
                                  onClick={() => grantEditor(username)}
                                  type="button"
                                >
                                  Make editor
                                </button>
                              )}
                              {(
                                [
                                  ["canEdit", "Edit"],
                                  ["canCreateTab", "Create"],
                                  ["canDeleteTab", "Delete"],
                                  ["canRenameTab", "Rename"],
                                ] as const
                              )
                                .filter(
                                  () =>
                                    canShowTabPermissionControls(userPerms)
                                )
                                .map(([key, label]) => (
                                  <button
                                    aria-pressed={userPerms[key]}
                                    className={cn(
                                      "cursor-pointer rounded-full border px-2 py-1 text-xs transition",
                                      userPerms[key]
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                    )}
                                    key={key}
                                    onClick={() =>
                                      updatePermissions(username, {
                                        ...userPerms,
                                        [key]: !userPerms[key],
                                      })
                                    }
                                    type="button"
                                  >
                                    {label}
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>
          )}

          <div
            className={`editor-host min-h-0 flex-1 ${wrapLines ? "wrap-on" : "no-wrap"}`}
          >
            {socketReady ? (
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
                socketRef={socketRef as unknown as RefObject<EditorSocket>}
                wrap={wrapLines}
              />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground text-sm">
                Connecting editor...
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
