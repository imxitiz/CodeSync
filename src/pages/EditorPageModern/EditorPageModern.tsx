import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import AppShell from "@/components/AppShell";
import EditorWrapper from "@/components/EditorWrapper";
import { TopBar } from "@/components/TopBar";
import { ACTIONS } from "@/utils/constants";
import EmptyState from "./EmptyState";
import { getFileIcon } from "./fileIcons";
import ParticipantsDrawer from "./ParticipantsDrawer";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TAB_ID,
  DEFAULT_TAB_NAME,
  withEditorAccess,
} from "./permissions";
import ShortcutsPanel from "./ShortcutsPanel";
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
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const [zen, setZen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

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

  const autoFollowTarget = useMemo(() => {
    if (!roomCreator) {
      return null;
    }
    if (currentEditor === userName) {
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
  const copyInviteLink = async () => {
    try {
      const link = `${window.location.origin}/editor/${id}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Failed to copy invite link");
    }
  };

  const copyCode = async () => {
    try {
      if (!activeTab?.code) {
        toast.error("No code to copy");
        return;
      }
      await navigator.clipboard.writeText(activeTab.code);
      toast.success("Code copied to clipboard");
    } catch {
      toast.error("Failed to copy code , please try again");
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
      emitCurrentEditor("");
      if (!isOwner) {
        setPermissions((prev) => ({
          ...prev,
          [userName]: { ...DEFAULT_PERMISSIONS },
        }));
        emitPermissionsUpdate(userName, DEFAULT_PERMISSIONS);
      }
      toast.success("Editor is now read-only");
    } else {
      if (!isOwner && !myPermissions.canEdit) {
        toast.error("You don't have permission to edit");
        return;
      }
      setCurrentEditor(userName);
      emitCurrentEditor(userName);
      if (!isOwner) {
        const editPerms = withEditorAccess(
          permissions[userName] || DEFAULT_PERMISSIONS,
        );
        setPermissions((prev) => ({ ...prev, [userName]: editPerms }));
        emitPermissionsUpdate(userName, editPerms);
      }
      toast.success("You are now the editor");
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
    if (followingUser) {
      setFollowingUser(null);
      setFollowMode("off");
      toast.success(
        `Stopped following — switched to ${tabs.find((t) => t.id === tabId)?.name ?? "tab"}`,
      );
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        !!target?.closest("[contenteditable='true']");
      if (
        e.key === "?" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !editing &&
        !showParticipants &&
        !showShortcuts
      ) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showParticipants, showShortcuts]);

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
            <TopBar
              canEdit={canEditCode}
              clients={sortedClients}
              connectionMessage={connectionMessage}
              connectionStatus={serverStatus}
              copied={copied}
              currentEditor={currentEditor}
              followingUser={followingUser}
              fontSize={fontSize}
              isOwner={isOwner}
              permissions={permissions}
              roomCreator={roomCreator}
              roomId={id}
              serverUrl={
                import.meta.env.VITE_BACKEND_API_URL || window.location.origin
              }
              userName={userName}
              wrapLines={wrapLines}
              zen={zen}
              onCopyCode={copyCode}
              onCopyInviteLink={copyInviteLink}
              onFontSizeChange={fontSizeChange}
              onFollowUser={toggleFollow}
              onGrantEdit={handleGrantEditor}
              onLeave={leaveRoom}
              onStopFollowing={() => {
                setFollowMode("off");
                setFollowingUser(null);
                toast.success("Stopped following");
              }}
              onToggleEdit={toggleEditable}
              onToggleParticipants={() => setShowParticipants(true)}
              onToggleWrap={() => setWrapLines((v) => !v)}
              onToggleZen={() => setZen((v) => !v)}
            />
          )}

          {/* Tab bar */}
          {!zen && (
            <div className="scrollbar-none flex items-center gap-0 overflow-x-auto border-b bg-background/80 px-1">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                const usersOnTab = tabUserCounts[tab.id];
                return (
                  <div
                    className={[
                      "group relative flex items-center gap-1.5 border-r px-2 py-1.5 text-xs transition-colors",
                      isActive
                        ? "border-t-2 border-t-primary bg-card font-medium text-foreground shadow-sm"
                        : "cursor-pointer text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                    ].join(" ")}
                    key={tab.id}
                    ref={(el) => {
                      if (isActive && el) {
                        el.scrollIntoView({
                          inline: "center",
                          block: "nearest",
                        });
                      }
                    }}
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
                        className="flex cursor-pointer items-center gap-1.5 bg-transparent text-inherit"
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
                        {getFileIcon(tab.name)}
                        <span className="max-w-20 truncate">{tab.name}</span>
                        {(isOwner || myPermissions.canRenameTab) && (
                          <span
                            className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            title="Double-click to rename"
                          >
                            ✎
                          </span>
                        )}
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
                          className={[
                            "cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive",
                            isActive
                              ? "inline-flex"
                              : "hidden group-hover:inline-flex",
                          ].join(" ")}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.id);
                          }}
                          aria-label={`Close ${tab.name}`}
                          title="Close tab"
                          type="button"
                        >
                          <X className="size-3" />
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
                  <Plus className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Editor canvas (fills remaining height) */}
          <section className="relative min-h-0 flex-1 overflow-hidden">
            {activeTab?.code === "" && tabs.length === 1 && (
              <EmptyState
                currentEditor={currentEditor}
                participantCount={sortedClients.length}
              />
            )}
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

      <ParticipantsDrawer
        open={showParticipants}
        onClose={() => {
          setShowParticipants(false);
          setPermDialogUser(null);
        }}
        onCopyInvite={copyInviteLink}
        onDone={() => {
          setShowParticipants(false);
          setPermDialogUser(null);
        }}
        participants={sortedClients}
        currentUser={userName}
        currentEditor={currentEditor}
        isOwner={isOwner}
        followingUser={followingUser}
        onFollow={toggleFollow}
        onGrantEditor={handleGrantEditor}
        openPermDialog={permDialogUser}
        onOpenPermDialog={setPermDialogUser}
        getActiveTabName={(uname) => {
          const tid = userActiveTabs[uname];
          return tid ? getTabName(tid) : undefined;
        }}
        userPermissions={permissions}
        onUpdatePermissions={handleUpdatePermissions}
      />

      <ShortcutsPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </AppShell>
  );
}
