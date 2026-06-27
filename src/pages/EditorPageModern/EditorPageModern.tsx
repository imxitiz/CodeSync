import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "react-avatar";
import toast from "react-hot-toast";
import { FaCrown } from "react-icons/fa";
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
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TAB_ID,
  DEFAULT_TAB_NAME,
  OWNER_PERMISSIONS,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
  withEditorAccess,
} from "./permissions";
import type {
  EditorSocketRef,
  EditorTab,
  FollowMode,
  UserPermissions,
} from "./types";
import { useEditorRealtime } from "./useEditorRealtime";

/**
 * EditorPageModern (Top-Bar + Tab Bar + Editor canvas)
 * - Multi-tab support with real-time sync
 * - Follow mode to track which tab other users are on
 * - Granular permissions system (owner can grant/revoke per-user)
 * - No page scroll; only internal areas can scroll
 */
export default function EditorPageModern() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userName = location.state?.userName || "User";

  // Multi-tab state
  const [tabs, setTabs] = useState<EditorTab[]>([
    { id: DEFAULT_TAB_ID, name: DEFAULT_TAB_NAME, code: "" },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TAB_ID);
  const tabsRef = useRef<EditorTab[]>(tabs);

  // Track which tab each user is on: username -> tabId
  const [userActiveTabs, setUserActiveTabs] = useState<Record<string, string>>(
    {},
  );

  // Follow mode: username being followed (null = not following)
  const [followingUser, setFollowingUser] = useState<string | null>(null);
  const [followMode, setFollowMode] = useState<FollowMode>("auto");

  // Per-user permissions: username -> permissions
  const [permissions, setPermissions] = useState<
    Record<string, UserPermissions>
  >({});

  // Permission management dialog
  const [permDialogUser, setPermDialogUser] = useState<string | null>(null);

  // Tab rename state
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  // Track current dark mode based on document root class
  const getIsDark = () => document?.documentElement.classList.contains("dark");
  const [isDark, setIsDark] = useState<boolean>(getIsDark());

  // biome-ignore lint/correctness/useExhaustiveDependencies: First load only
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(getIsDark());
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // UI state
  const [fontSize, setFontSize] = useState(16);
  const [wrapLines, setWrapLines] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  const [showParticipants, setShowParticipants] = useState<boolean>(false);
  const [zen, setZen] = useState<boolean>(false);

  const handleCodeChange = useCallback(
    (code: string, tabId?: string) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === (tabId ?? activeTabId) ? { ...t, code } : t)),
      );
    },
    [activeTabId],
  );

  const {
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
    socketRef,
  } = useEditorRealtime({
    roomId: id,
    userName,
    navigate,
    tabsRef,
    handleCodeChange,
    setTabs,
    setActiveTabId,
    setUserActiveTabs,
    setFollowingUser,
    setPermissions,
  });

  // Derived
  const isOwner = userName === roomCreator;
  const myPermissions: UserPermissions =
    permissions[userName] || DEFAULT_PERMISSIONS;
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const canEditCode = isOwner || myPermissions.canEdit;

  const applyActiveTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId);
      setUserActiveTabs((prev) => ({ ...prev, [userName]: tabId }));
    },
    [userName],
  );

  // Keep refs in sync
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const sortedClients = useMemo(
    () =>
      [...(clients || [])].sort((a, b) => {
        if (a.username === roomCreator) {
          return -1;
        }
        if (b.username === roomCreator) {
          return 1;
        }
        return 0;
      }),
    [clients, roomCreator],
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
      (client) => client.username === roomCreator,
    );
    if (ownerActive && roomCreator !== userName) {
      return roomCreator;
    }
    if (currentEditor && currentEditor !== userName) {
      return currentEditor;
    }
    return null;
  }, [roomCreator, clients, currentEditor, userName]);

  // Get tab name by id for display
  const getTabName = useCallback(
    (tabId: string): string => {
      const t = tabs.find((tab) => tab.id === tabId);
      return t ? t.name : "unknown";
    },
    [tabs],
  );

  // Handlers
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
    if (isOwner) {
      if (
        !window.confirm(
          "You are the room owner. Leaving will destroy the room. Are you sure?",
        )
      ) {
        return;
      }
      socketRef.current?.emit(ACTIONS.DESTROY_ROOM, { roomId: id });
    }
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
    } else {
      if (!isOwner) {
        toast.error("Only the room creator can change the editable state");
        return;
      }
      setCurrentEditor(userName);
      toast.success("Editor is now editable");
      emitCurrentEditor(userName);
    }
  };

  const handleGrantEditor = (username: string) => {
    setCurrentEditor(username);
    emitCurrentEditor(username);
    const nextPerms = withEditorAccess(
      permissions[username] || DEFAULT_PERMISSIONS,
    );
    handleUpdatePermissions(username, nextPerms);
  };

  // Tab management
  const handleCreateTab = () => {
    if (!(isOwner || myPermissions.canCreateTab)) {
      toast.error("You don't have permission to create tabs");
      return;
    }
    const tabId = `tab-${uuidv4()}`;
    const name = `file-${tabs.length + 1}.js`;
    const newTab: EditorTab = { id: tabId, name, code: "" };
    setTabs((prev) => [...prev, newTab]);
    applyActiveTab(tabId);
    emitTabCreate(tabId, name);
    emitTabSwitch(tabId);
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
      const filtered = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId && filtered.length > 0) {
        const newActive = filtered[0]?.id || DEFAULT_TAB_ID;
        applyActiveTab(newActive);
        emitTabSwitch(newActive);
      }
      return filtered;
    });
    emitTabClose(tabId);
  };

  const handleSwitchTab = (tabId: string) => {
    if (tabId === activeTabId) {
      return;
    }
    applyActiveTab(tabId);
    emitTabSwitch(tabId);
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
      prev.map((t) => (t.id === tabId ? { ...t, name: trimmed } : t)),
    );
    emitTabRename(tabId, trimmed);
    setRenamingTabId(null);
    setRenameValue("");
  };

  useEffect(() => {
    if (followMode !== "auto") {
      return;
    }
    if (!autoFollowTarget) {
      setFollowingUser(null);
      return;
    }
    if (followingUser !== autoFollowTarget) {
      setFollowingUser(autoFollowTarget);
    }
  }, [followMode, autoFollowTarget, followingUser]);

  // Follow mode: auto-switch tab when followed user switches
  useEffect(() => {
    if (followingUser && userActiveTabs[followingUser]) {
      const targetTab = userActiveTabs[followingUser];
      if (targetTab && targetTab !== activeTabId) {
        applyActiveTab(targetTab);
        emitTabSwitch(targetTab);
      }
    }
  }, [
    followingUser,
    userActiveTabs,
    activeTabId,
    applyActiveTab,
    emitTabSwitch,
  ]);

  useEffect(() => {
    if (!id) {
      return;
    }
    if (!activeTabId) {
      return;
    }
    socketRef.current?.emit(ACTIONS.TAB_CODE_REQUEST, {
      roomId: id,
      tabId: activeTabId,
    });
  }, [activeTabId, id, socketRef]);

  const toggleFollow = (username: string) => {
    if (followingUser === username && followMode === "manual") {
      setFollowMode("off");
      setFollowingUser(null);
      toast.success("Stopped following");
    } else {
      setFollowMode("manual");
      setFollowingUser(username);
      toast.success(`Following ${username}`);
      // Immediately switch to their tab
      const targetTab = userActiveTabs[username];
      if (targetTab && targetTab !== activeTabId) {
        applyActiveTab(targetTab);
        emitTabSwitch(targetTab);
      }
    }
  };

  // Permissions management
  const handleUpdatePermissions = (
    targetUser: string,
    newPerms: UserPermissions,
  ) => {
    if (!isOwner) {
      toast.error("Only the owner can change permissions");
      return;
    }
    setPermissions((prev) => ({ ...prev, [targetUser]: newPerms }));
    emitPermissionsUpdate(targetUser, newPerms);
    toast.success(`Permissions updated for ${targetUser}`);

    if (!newPerms.canEdit && targetUser === currentEditor) {
      setCurrentEditor("");
      emitCurrentEditor("");
    }
  };

  // Redirect if no state
  useEffect(() => {
    if (!location.state) {
      if (id) {
        navigate("/", {
          state: { id },
        });
      } else {
        navigate("/");
      }
    }
  }, [location.state, id, navigate]);

  // Count users on each tab (for tab badges)
  const tabUserCounts = useMemo(() => {
    const counts: Record<string, string[]> = {};
    for (const [uname, tabIdVal] of Object.entries(userActiveTabs)) {
      if (uname === userName) {
        continue;
      }
      if (!counts[tabIdVal]) {
        counts[tabIdVal] = [];
      }
      counts[tabIdVal]?.push(uname);
    }
    return counts;
  }, [userActiveTabs, userName]);

  // UI
  return (
    <AppShell className="relative overflow-hidden">
      {/* Prevent page-level scroll; only internal regions may scroll */}
      <div className="h-full w-full overflow-hidden bg-background">
        {/* CodeMirror scroller rules */}
        <style>{`
          /* Host container fills the available area */
          .editor-host {
            position: absolute;
            inset: 0;
            height: 100%;
            width: 100%;
            min-height: 0;
            min-width: 0;
          }
          /* CodeMirror root must occupy full size */
          .editor-host .cm-editor {
            height: 100% !important;
            width: 100% !important;
            min-height: 0 !important;
            min-width: 0 !important;
            line-height: 1.6;
            background: var(--card);
            /* do NOT set overflow here; scroller handles it */
          }
          /* Primary scroll container (both axes) */
          .editor-host .cm-scroller {
            height: 100% !important;
            width: 100% !important;
            min-height: 0 !important;
            min-width: 0 !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            scrollbar-gutter: stable both-edges;
          }
          /* Ensure gutters/content fill and scroll properly */
          .editor-host .cm-gutters {
            height: 100% !important;
          }
          .editor-host .cm-content {
            box-sizing: border-box !important;
          }
          /* Horizontal scroll when wrapping is disabled */
          .editor-host.no-wrap .cm-content {
            min-width: max-content;
            white-space: pre;
          }
          /* Wrap long lines when enabled */
          .editor-host.wrap-on .cm-content {
            min-width: 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
        `}</style>

        {/* Column layout: top-bar + tab-bar + editor canvas */}
        <div className="flex h-full flex-col overflow-hidden">
          {/* Top bar (hidden in Zen) */}
          {!zen && (
            <div className="sticky top-0 z-35 flex items-center gap-1 overflow-x-auto border-b bg-background/90 px-2 py-1.5 backdrop-blur supports-backdrop-filter:bg-background/70 sm:gap-2 sm:px-3">
              {/* Left: room info */}
              <div className="min-w-0 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-sm">Room</span>
                  <button
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 font-mono text-[11px] text-secondary-foreground transition-colors hover:bg-secondary/80"
                    onClick={copyRoomId}
                    title="Click to copy room ID"
                    type="button"
                  >
                    {id && id.length > 12 ? `${id.slice(0, 8)}…` : id}
                    <FaRegCopy className="size-3 opacity-50" />
                  </button>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-muted-foreground text-xs">
                  <span className="max-w-[120px] truncate">{userName}</span>
                  {serverStatus === "connected" ? (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                      title="Connected"
                    />
                  ) : (
                    <span
                      aria-live="polite"
                      className="inline-flex shrink-0 items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200"
                    >
                      {connectionMessage}
                    </span>
                  )}
                </p>
              </div>

              {/* Middle: compact participants */}
              <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 sm:flex">
                <div className="flex items-center gap-1">
                  {compactAvatars.slice.map(({ socketId, username }) => {
                    const crown = username === roomCreator;
                    const userPerms =
                      permissions[username] || DEFAULT_PERMISSIONS;
                    const pencil =
                      username === currentEditor && userPerms.canEdit;
                    const me = username === userName;
                    return (
                      <div className="relative" key={socketId}>
                        <Avatar
                          fgColor="#000"
                          name={username}
                          round="8px"
                          size="28"
                        />
                        {me && (
                          <span
                            className="-bottom-0.5 -right-0.5 absolute size-2.5 rounded-full border-2 border-card bg-primary"
                            title="You"
                          />
                        )}
                        {crown ? (
                          <span
                            className="-right-1 -top-1 pointer-events-none absolute inline-flex size-4 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm ring-1 ring-border"
                            title="Owner"
                          >
                            <FaCrown className="size-2.5" />
                          </span>
                        ) : null}
                        {pencil ? (
                          <span
                            className="-left-1 -bottom-1 pointer-events-none absolute inline-flex size-4 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-sm ring-1 ring-border"
                            title="Editor"
                          >
                            <FiEdit2 className="size-2.5" />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {compactAvatars.extra > 0 && (
                    <button
                      aria-label="Show all participants"
                      className="ms-1 cursor-pointer rounded-md border bg-background px-1.5 py-0.5 text-foreground text-xs hover:bg-accent"
                      onClick={() => setShowParticipants(true)}
                      title="Show all participants"
                      type="button"
                    >
                      +{compactAvatars.extra}
                    </button>
                  )}
                </div>
              </div>

              {/* Right: tools — grouped with separators */}
              <div className="ml-auto flex shrink-0 items-center">
                {/* Editor display controls */}
                <div className="flex items-center gap-0.5">
                  <Button
                    onClick={() => fontSizeChange(2)}
                    size="sm"
                    title="Increase editor text size"
                    variant="ghost"
                  >
                    <MdTextIncrease />
                  </Button>
                  <Button
                    onClick={() => fontSizeChange(-2)}
                    size="sm"
                    title="Decrease editor text size"
                    variant="ghost"
                  >
                    <MdTextDecrease />
                  </Button>
                  <Button
                    className="hidden sm:inline-flex"
                    onClick={() => setWrapLines((v) => !v)}
                    size="sm"
                    title="Toggle line wrap"
                    variant={wrapLines ? "secondary" : "ghost"}
                  >
                    {wrapLines ? "Wrap" : "Wrap"}
                  </Button>
                </div>

                {/* Separator */}
                <div
                  aria-hidden="true"
                  className="mx-1.5 hidden h-5 w-px bg-border sm:block"
                />

                {/* Code actions */}
                <div className="flex items-center gap-0.5">
                  <Button
                    onClick={copyCode}
                    size="sm"
                    title="Copy code"
                    variant="ghost"
                  >
                    <FaRegCopy />
                    <span className="hidden sm:inline-block">Copy</span>
                  </Button>

                  {(currentEditor === userName ||
                    (isOwner && currentEditor !== "")) && (
                    <Button
                      onClick={toggleEditable}
                      size="sm"
                      title={
                        currentEditor === userName
                          ? "Release Control"
                          : "Take Control"
                      }
                      variant={
                        currentEditor === userName ? "secondary" : "default"
                      }
                    >
                      {currentEditor === userName ? "Release" : "Take"}
                    </Button>
                  )}
                </div>

                {/* Separator */}
                <div
                  aria-hidden="true"
                  className="mx-1.5 hidden h-5 w-px bg-border sm:block"
                />

                {/* Room actions */}
                <div className="flex items-center gap-0.5">
                  <Button
                    onClick={() => setShowParticipants(true)}
                    size="sm"
                    title="Toggle participants"
                    variant="ghost"
                  >
                    <FiUsers />
                    <span className="hidden sm:inline-block">People</span>
                  </Button>

                  {followingUser && (
                    <Button
                      onClick={() => {
                        setFollowMode("off");
                        setFollowingUser(null);
                        toast.success("Stopped following");
                      }}
                      size="sm"
                      title="Stop following"
                      variant="secondary"
                    >
                      <FiEye />
                      <span className="hidden sm:inline-block">
                        {followingUser}
                      </span>
                    </Button>
                  )}

                  <Button
                    className="hidden sm:inline-flex"
                    onClick={() => setZen((v) => !v)}
                    size="sm"
                    title={zen ? "Exit Zen mode" : "Enter Zen mode"}
                    variant={zen ? "secondary" : "ghost"}
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
                    <span className="hidden sm:inline-block">Leave</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tab bar */}
          {!zen && (
            <div className="flex items-center gap-0 overflow-x-auto border-b bg-background/80 px-1">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const usersOnTab = tabUserCounts[tab.id];
                return (
                  <div
                    className={[
                      "group relative flex items-center gap-1 border-r px-2 py-1.5 text-xs transition-colors",
                      isActive
                        ? "bg-card font-medium text-foreground"
                        : "cursor-pointer text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    ].join(" ")}
                    key={tab.id}
                  >
                    {renamingTabId === tab.id ? (
                      <input
                        className="w-20 rounded border bg-background px-1 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                        onBlur={() => handleRenameTab(tab.id, renameValue)}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleRenameTab(tab.id, renameValue);
                          }
                          if (e.key === "Escape") {
                            setRenamingTabId(null);
                            setRenameValue("");
                          }
                        }}
                        value={renameValue}
                      />
                    ) : (
                      <button
                        className="cursor-pointer truncate bg-transparent text-inherit"
                        onClick={() => handleSwitchTab(tab.id)}
                        onDoubleClick={() => {
                          if (isOwner || myPermissions.canRenameTab) {
                            setRenamingTabId(tab.id);
                            setRenameValue(tab.name);
                          }
                        }}
                        title={`${tab.name}${usersOnTab ? ` (${usersOnTab.join(", ")})` : ""}`}
                        type="button"
                      >
                        {tab.name}
                      </button>
                    )}
                    {usersOnTab && usersOnTab.length > 0 && (
                      <span
                        className="inline-flex size-4 items-center justify-center rounded-full bg-primary/20 text-[9px] text-primary"
                        title={usersOnTab.join(", ")}
                      >
                        {usersOnTab.length}
                      </span>
                    )}
                    {tabs.length > 1 &&
                      (isOwner || myPermissions.canDeleteTab) && (
                        <button
                          className="hidden cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive group-hover:inline-flex"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                          title="Close tab"
                          type="button"
                        >
                          <FiX className="size-3" />
                        </button>
                      )}
                  </div>
                );
              })}
              {(isOwner || myPermissions.canCreateTab) && (
                <button
                  className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-accent/40 hover:text-foreground"
                  onClick={handleCreateTab}
                  title="New tab"
                  type="button"
                >
                  <FiPlus className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Editor canvas (fills remaining height) */}
          <section className="relative min-h-0 flex-1 overflow-hidden">
            {/* Exit Zen small control */}
            {zen && (
              <button
                aria-label="Exit Zen mode"
                className="absolute top-3 right-3 z-20 inline-flex cursor-pointer items-center justify-center rounded-md border bg-background/90 px-2 py-1 text-xs shadow-sm outline-none backdrop-blur focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={() => setZen(false)}
                title="Exit Zen mode"
                type="button"
              >
                Exit Zen
              </button>
            )}

            {/* Participants Panel (overlay) */}
            {showParticipants && (
              <div
                aria-labelledby="participants-title"
                aria-modal="true"
                className="absolute inset-0 z-50 grid place-items-center p-3"
                role="dialog"
              >
                <div
                  className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                  onClick={() => {
                    setShowParticipants(false);
                    setPermDialogUser(null);
                  }}
                />
                <div className="relative z-10 w-full max-w-4xl rounded-lg border bg-card text-card-foreground shadow-lg">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2
                      className="font-semibold text-sm"
                      id="participants-title"
                    >
                      Participants ({sortedClients.length})
                    </h2>
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <span className="text-muted-foreground text-xs">
                          Click user to grant editor · Gear for permissions
                        </span>
                      )}
                      <Button
                        onClick={() => {
                          setShowParticipants(false);
                          setPermDialogUser(null);
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[70svh] overflow-y-auto px-4 py-3">
                    <div className="space-y-2">
                      {sortedClients.map(({ socketId, username }) => (
                        <div key={socketId}>
                          <div className="flex items-center gap-2">
                            <div
                              className={
                                isOwner ? "flex-1 cursor-pointer" : "flex-1"
                              }
                              onClick={
                                isOwner
                                  ? () => handleGrantEditor(username)
                                  : undefined
                              }
                              title={
                                isOwner ? "Click to grant editor" : undefined
                              }
                            >
                              <ClientModern
                                activeTab={
                                  userActiveTabs[username]
                                    ? getTabName(userActiveTabs[username] ?? "")
                                    : activeTab?.name
                                }
                                canGrantEdit={isOwner}
                                currentEditor={currentEditor}
                                isMe={username === userName}
                                roomcreator={roomCreator}
                                username={username}
                              />
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {/* Follow button */}
                              {username !== userName && (
                                <Button
                                  onClick={() => toggleFollow(username)}
                                  size="sm"
                                  title={
                                    followingUser === username
                                      ? "Stop following"
                                      : `Follow ${username}`
                                  }
                                  variant={
                                    followingUser === username
                                      ? "secondary"
                                      : "ghost"
                                  }
                                >
                                  <FiEye className="size-3" />
                                </Button>
                              )}
                              {/* Permissions button (owner only, not for self) */}
                              {isOwner && username !== userName && (
                                <Button
                                  aria-label="Manage permissions"
                                  onClick={() =>
                                    setPermDialogUser(
                                      permDialogUser === username
                                        ? null
                                        : username,
                                    )
                                  }
                                  size="sm"
                                  title="Manage permissions"
                                  variant={
                                    permDialogUser === username
                                      ? "secondary"
                                      : "ghost"
                                  }
                                >
                                  <span aria-hidden="true">⚙</span>
                                </Button>
                              )}
                            </div>
                          </div>
                          {/* Inline permissions editor */}
                          {permDialogUser === username && isOwner && (
                            <PermissionsEditor
                              onUpdate={(p) =>
                                handleUpdatePermissions(username, p)
                              }
                              permissions={
                                permissions[username] || DEFAULT_PERMISSIONS
                              }
                              username={username}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                    <Button onClick={copyRoomId} size="sm" variant="outline">
                      Copy Room Id
                    </Button>
                    <Button
                      onClick={() => {
                        setShowParticipants(false);
                        setPermDialogUser(null);
                      }}
                      size="sm"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Editor wrapper takes full available space (keyed by tabId to remount) */}
            {activeTab && (
              <div
                className={`editor-host h-full w-full ${wrapLines ? "wrap-on" : "no-wrap"}`}
              >
                <EditorWrapper
                  activeTabId={activeTab.id}
                  currentEditor={currentEditor}
                  darkMode={isDark}
                  editable={canEditCode}
                  fontSize={fontSize}
                  initialCode={activeTab.code}
                  onCodeChange={handleCodeChange}
                  roomId={id || ""}
                  setCurrentEditor={setCurrentEditor}
                  socketRef={socketRef as EditorSocketRef}
                  wrap={wrapLines}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/** Inline permissions editor component */
function PermissionsEditor({
  username,
  permissions: perms,
  onUpdate,
}: {
  username: string;
  permissions: UserPermissions;
  onUpdate: (p: UserPermissions) => void;
}) {
  const toggle = (key: keyof UserPermissions) => {
    onUpdate({ ...perms, [key]: !perms[key] });
  };

  const revokeAll = () => {
    onUpdate({ ...DEFAULT_PERMISSIONS });
  };

  const grantAll = () => {
    onUpdate({ ...OWNER_PERMISSIONS });
  };

  return (
    <div className="mt-1 ml-12 rounded-md border bg-background/50 p-3">
      <p className="mb-2 font-medium text-xs">Permissions for {username}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {PERMISSION_KEYS.map((key) => (
          <label className="flex cursor-pointer items-center gap-2" key={key}>
            <input
              checked={perms[key]}
              className="cursor-pointer accent-primary"
              onChange={() => toggle(key)}
              type="checkbox"
            />
            {PERMISSION_LABELS[key]}
          </label>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Button onClick={grantAll} size="sm" variant="outline">
          Grant All
        </Button>
        <Button onClick={revokeAll} size="sm" variant="destructive">
          Revoke All
        </Button>
      </div>
    </div>
  );
}
