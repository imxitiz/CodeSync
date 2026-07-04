import { Clock, Lock, Plus, X } from "lucide-react";
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
import TransferOwnerDialog from "./TransferOwnerDialog";
import type {
  EditorSocketRef,
  EditorTab,
  FollowMode,
  TabPermissionLevel,
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
  const reclaimToken = location.state?.reclaimToken;

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
  const [wasViewer, setWasViewer] = useState(false);

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
    emitTabPermissionRequest,
    emitTabPermissionGrant,
    emitTabPermissionRevoke,
    emitEditRequestsToggle,
    emitTransferOwner,
    roomCreator,
    serverStatus,
    setCurrentEditor,
    socketReady,
    socketRef,
    tabEditors,
    tabPermissions,
    allowEditRequests,
    cooldowns,
  } = useEditorRealtime({
    roomId: id,
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
  });

  // Derived
  const isOwner = userName === roomCreator;
  const myPermissions: UserPermissions =
    permissions[userName] || DEFAULT_PERMISSIONS;
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  // Tab-level permission derivation
  const activeTabPermission: TabPermissionLevel = useMemo(() => {
    if (isOwner) return "EDITOR";
    const tabLevel = tabPermissions[activeTabId]?.[userName];
    if (tabLevel) return tabLevel;
    return myPermissions.canEdit ? "EDITOR" : "VIEWER";
  }, [isOwner, tabPermissions, activeTabId, userName, myPermissions.canEdit]);

  const canEditActiveTab = activeTabPermission === "EDITOR";

  // Can this user request edit access on the active tab?
  const cooldownRemaining = cooldowns[activeTabId] ?? 0;
  const canRequestEdit =
    !isOwner &&
    activeTabPermission === "VIEWER" &&
    allowEditRequests &&
    cooldownRemaining <= 0;

  // Pending request count (for owner)
  const pendingRequestCount = useMemo(() => {
    if (!isOwner) return 0;
    let count = 0;
    for (const entry of Object.values(tabPermissions)) {
      for (const level of Object.values(entry)) {
        if (level === "REQUESTED") count++;
      }
    }
    return count;
  }, [isOwner, tabPermissions]);

  // Track previous permission state to detect grant transitions for flash effect
  useEffect(() => {
    if (wasViewer && canEditActiveTab) {
      // Permission was just granted — flash will play via class toggle
    }
    setWasViewer(activeTabPermission === "VIEWER");
  }, [activeTabPermission, canEditActiveTab, wasViewer]);

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

  const [showTransferDialog, setShowTransferDialog] = useState(false);

  const leaveRoom = () => {
    if (isOwner && clients.length > 1) {
      // Owner with other participants — offer transfer or destroy.
      setShowTransferDialog(true);
      return;
    }
    // Non-owner, or owner alone — leave/destroy directly.
    if (isOwner) {
      socketRef.current?.emit(ACTIONS.DESTROY_ROOM, {
        roomId: id,
        reclaimToken,
      });
    }
    if (sessionStorage.getItem("admin") === roomCreator) {
      sessionStorage.removeItem("admin");
    }
    navigate("/");
  };

  const handleTransferAndLeave = (newOwner: string) => {
    emitTransferOwner(newOwner);
    if (sessionStorage.getItem("admin") === roomCreator) {
      sessionStorage.removeItem("admin");
    }
    navigate("/");
  };

  const handleDestroyAndLeave = () => {
    socketRef.current?.emit(ACTIONS.DESTROY_ROOM, { roomId: id, reclaimToken });
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
      socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: "",
        tabId: activeTabId,
      });
      if (!isOwner) {
        setPermissions((prev) => ({
          ...prev,
          [userName]: { ...DEFAULT_PERMISSIONS },
        }));
        emitPermissionsUpdate(userName, DEFAULT_PERMISSIONS);
      }
      toast.success("Editor is now read-only");
    } else {
      if (!isOwner && !canEditActiveTab) {
        // If user doesn't have tab-level permission, request it
        if (activeTabPermission === "VIEWER") {
          if (!allowEditRequests) {
            toast.error("Edit requests are disabled by the owner");
            return;
          }
          emitTabPermissionRequest(activeTabId);
          toast.success("Edit request sent!");
          return;
        }
        if (activeTabPermission === "REQUESTED") {
          toast("Edit request pending...", { icon: "🕐" });
          return;
        }
        toast.error("You don't have permission to edit");
        return;
      }
      setCurrentEditor(userName);
      socketRef.current?.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: userName,
        tabId: activeTabId,
      });
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

  // Compute per-tab permission levels for the current user (for lock icons)
  const myTabLevels = useMemo(() => {
    const result: Record<string, TabPermissionLevel> = {};
    for (const tab of tabs) {
      if (isOwner) {
        result[tab.id] = "EDITOR";
      } else {
        result[tab.id] =
          tabPermissions[tab.id]?.[userName] ??
          (myPermissions.canEdit ? "EDITOR" : "VIEWER");
      }
    }
    return result;
  }, [tabs, isOwner, tabPermissions, userName, myPermissions.canEdit]);

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
          /* Host container fills the available flex space */
          .editor-host {
            flex: 1;
            min-height: 0;
            min-width: 0;
            height: 100%;
            width: 100%;
            transition: opacity 0.15s ease;
          }
          /* Smooth transition when switching between editable/read-only */
          .editor-host.read-only {
            opacity: 0.95;
          }
          /* Flash effect when permission is granted */
          @keyframes permission-granted-flash {
            0% {
              box-shadow: inset 0 0 0 2px var(--success);
            }
            100% {
              box-shadow: inset 0 0 0 2px transparent;
            }
          }
          .editor-host.permission-granted {
            animation: permission-granted-flash 0.6s ease-out;
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
              canEdit={canEditActiveTab}
              clients={sortedClients}
              connectionMessage={connectionMessage}
              connectionStatus={serverStatus}
              copied={copied}
              currentEditor={currentEditor}
              tabEditors={tabEditors}
              activeTabId={activeTabId}
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
              activeTabPermission={activeTabPermission}
              onRequestTabEdit={() => emitTabPermissionRequest(activeTabId)}
              pendingRequestCount={isOwner ? pendingRequestCount : 0}
              allowEditRequests={allowEditRequests}
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
                      myTabLevels[tab.id] === "VIEWER" && !isActive
                        ? "bg-muted/30"
                        : "",
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
                        {myTabLevels[tab.id] === "VIEWER" &&
                          tabs.length > 1 && (
                            <span title="Read-only on this tab">
                              <Lock className="size-3 text-muted-foreground/60" />
                            </span>
                          )}
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
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Inline read-only indicator — small chip, not a full banner */}
            {activeTabPermission === "VIEWER" &&
              !canRequestEdit &&
              cooldownRemaining <= 0 &&
              allowEditRequests && (
                <div className="flex shrink-0 items-center gap-2 border-b bg-muted/20 px-3 py-1 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  <span>Read-only</span>
                </div>
              )}

            {canRequestEdit && (
              <div className="flex shrink-0 items-center gap-2 border-b bg-primary/5 px-3 py-1.5 text-xs">
                <Lock className="size-3 text-primary" />
                <span className="text-muted-foreground">
                  You have read-only access
                </span>
                <button
                  className="ml-auto cursor-pointer rounded bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  onClick={() => emitTabPermissionRequest(activeTabId)}
                  type="button"
                >
                  Request Edit
                </button>
              </div>
            )}

            {activeTabPermission === "REQUESTED" && (
              <div className="flex shrink-0 items-center gap-2 border-b bg-amber-500/5 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Clock className="size-3" />
                <span>Edit request pending</span>
              </div>
            )}

            {cooldownRemaining > 0 && activeTabPermission === "VIEWER" && (
              <div className="flex shrink-0 items-center gap-2 border-b bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
                <Clock className="size-3" />
                <span>
                  Request blocked — wait {Math.ceil(cooldownRemaining / 60000)}{" "}
                  min
                </span>
              </div>
            )}
            {activeTab?.code === "" && tabs.length === 1 && (
              <EmptyState
                currentEditor={currentEditor}
                participantCount={sortedClients.length}
                isOwner={isOwner}
                canEdit={canEditActiveTab}
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
                className={`editor-host h-full w-full ${wrapLines ? "wrap-on" : "no-wrap"} ${!canEditActiveTab ? "read-only" : ""} ${wasViewer && canEditActiveTab ? "permission-granted" : ""}`}
              >
                <EditorWrapper
                  key={activeTab.id}
                  activeTabId={activeTab.id}
                  currentEditor={currentEditor}
                  darkMode={isDark}
                  editable={canEditActiveTab}
                  fontSize={fontSize}
                  initialCode={activeTab.code}
                  onCodeChange={handleCodeChange}
                  roomId={id || ""}
                  setCurrentEditor={setCurrentEditor}
                  socketReady={socketReady}
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
        roomCreator={roomCreator}
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
        tabs={tabs}
        tabPermissions={tabPermissions}
        emitTabPermissionGrant={emitTabPermissionGrant}
        emitTabPermissionRevoke={emitTabPermissionRevoke}
        allowEditRequests={allowEditRequests}
        emitEditRequestsToggle={emitEditRequestsToggle}
      />

      <TransferOwnerDialog
        open={showTransferDialog}
        onClose={() => setShowTransferDialog(false)}
        participants={sortedClients.filter((c) => c.username !== userName)}
        onTransfer={handleTransferAndLeave}
        onDestroy={handleDestroyAndLeave}
      />

      <ShortcutsPanel
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </AppShell>
  );
}
