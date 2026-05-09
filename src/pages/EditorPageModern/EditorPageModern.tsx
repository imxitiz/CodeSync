import { useCallback, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { FiMinimize2 } from "react-icons/fi";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import AppShell from "../../components/AppShell";
import EditorWrapper from "../../components/EditorWrapper";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { ParticipantsPanel } from "./components/ParticipantsPanel";

import { useEditorState } from "./hooks/useEditorState";
import { useTransport } from "./hooks/useTransport";
import { usePermissions } from "./hooks/usePermissions";

import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TAB_ID,
  canUserEditTab,
} from "./permissions";

export default function EditorPageModern() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const userName = location.state?.userName || `User${Math.floor(Math.random() * 1000)}`;

  const {
    tabs, setTabs, tabsRef,
    activeTabId, setActiveTabId,
    userActiveTabs, setUserActiveTabs,
    followingUser, setFollowingUser,
    renamingTabId, setRenamingTabId,
    renameValue, setRenameValue,
    fontSize, fontSizeChange,
    wrapLines, setWrapLines,
    showParticipants, setShowParticipants,
    zen, setZen,
    handleCodeChangeLocal,
  } = useEditorState();

  const transport = useTransport({
    roomId: id,
    userName,
    navigate,
    onTabSync: ({ tabs: syncTabs, activeTabId: syncActive, userActiveTabs: syncUserTabs, permissions: syncPerms }) => {
      if (syncTabs.length) setTabs(syncTabs);
      if (syncActive) setActiveTabId(syncActive);
      if (syncUserTabs) {
        setUserActiveTabs(Object.fromEntries(syncUserTabs.map(u => [u.username, u.activeTabId])));
      }
      if (syncPerms) setPermissions(syncPerms);
    },
    onTabCreate: ({ tabId, name }) => {
      setTabs(prev => [...prev, { id: tabId, name, code: "" }]);
    },
    onTabClose: ({ tabId }) => {
      setTabs(prev => prev.filter(t => t.id !== tabId));
      if (activeTabId === tabId) {
          const nextTabId = tabsRef.current.find(t => t.id !== tabId)?.id || DEFAULT_TAB_ID;
          setActiveTabId(nextTabId);
      }
    },
    onTabRename: ({ tabId, name }) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name } : t));
    },
    onTabCode: ({ tabId, code }) => {
      handleCodeChangeLocal(code, tabId);
    },
    onTabSwitch: ({ username, tabId }) => {
      setUserActiveTabs(prev => ({ ...prev, [username]: tabId }));
      if (username === followingUser) setActiveTabId(tabId);
    },
    onPermissionsUpdate: ({ username, permissions: nextPerms }) => {
      setPermissions(prev => ({ ...prev, [username]: nextPerms }));
      if (username === userName) toast.success("Permissions updated");
    },
    onCodeChange: ({ tabId, code, currenteditor }) => {
        handleCodeChangeLocal(code, tabId);
        transport.setCurrentEditor(currenteditor);
    }
  });

  const { 
      permissions, setPermissions, updatePermissions, grantEditor, takeControl 
  } = usePermissions(id, transport.roomCreator, transport.emitPermissionsUpdate, transport.emitCurrentEditor);

  const isOwner = userName === transport.roomCreator;
  const myPermissions = permissions[userName] || DEFAULT_PERMISSIONS;
  const canEditCode = isOwner || transport.currentEditor === userName;

  const handleCreateTab = useCallback(() => {
    if (!isOwner && !myPermissions.canCreateTab) {
      toast.error("You don't have permission to create tabs");
      return;
    }
    const newId = uuidv4();
    const newName = "new_file.js";
    setTabs(prev => [...prev, { id: newId, name: newName, code: "" }]);
    setActiveTabId(newId);
    transport.emitTabCreate(newId, newName);
  }, [isOwner, myPermissions, transport, setActiveTabId, setTabs]);

  const handleCloseTab = useCallback((tabId: string) => {
    if (!isOwner && !myPermissions.canDeleteTab) {
      toast.error("You don't have permission to delete tabs");
      return;
    }
    if (tabs.length <= 1) {
      toast.error("Cannot close the last tab");
      return;
    }
    
    const targetTab = tabs.find(t => t.id === tabId);
    if (!confirm(`Are you sure you want to close "${targetTab?.name || 'this tab'}"?`)) return;

    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      const nextTabId = tabs.find(t => t.id !== tabId)?.id || DEFAULT_TAB_ID;
      setActiveTabId(nextTabId);
      transport.emitTabSwitch(nextTabId);
    }
    transport.emitTabClose(tabId);
  }, [isOwner, myPermissions, tabs, activeTabId, transport, setActiveTabId, setTabs]);

  const handleRenameTab = useCallback((tabId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setRenamingTabId(null);
      return;
    }
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, name: trimmed } : t));
    transport.emitTabRename(tabId, trimmed);
    setRenamingTabId(null);
  }, [transport, setRenamingTabId, setTabs]);

  const handleSwitchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    transport.emitTabSwitch(tabId);
    if (followingUser) setFollowingUser(null);
  }, [transport, followingUser, setFollowingUser, setActiveTabId]);

  const toggleFollow = useCallback((targetUser: string) => {
    if (followingUser === targetUser) {
      setFollowingUser(null);
      toast("Stopped following");
    } else {
      setFollowingUser(targetUser);
      const targetTabId = userActiveTabs[targetUser];
      if (targetTabId) setActiveTabId(targetTabId);
      toast(`Following ${targetUser}`);
    }
  }, [followingUser, userActiveTabs, setFollowingUser, setActiveTabId]);

  const toggleEditable = useCallback(() => {
    if (!isOwner) {
      if (transport.currentEditor === userName) {
        transport.emitCurrentEditor("");
      } else {
        toast.error("Only the owner can grant editing access or take control");
      }
      return;
    }

    if (transport.currentEditor === userName) {
      transport.emitCurrentEditor("");
    } else {
      takeControl(userName);
    }
  }, [isOwner, transport, userName, takeControl]);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const roleLabel = isOwner ? "Owner" : transport.currentEditor === userName ? "Editor" : "Viewer";
  
  const getTabName = (tid: string) => tabs.find(t => t.id === tid)?.name || "";

  const compactAvatars = useMemo(() => {
    const others = transport.clients.filter(c => c.username !== userName);
    const slice = others.slice(0, 3);
    const extra = Math.max(0, others.length - 3);
    return { slice, extra };
  }, [transport.clients, userName]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.altKey && e.shiftKey) {
            if (e.key === "N") {
                e.preventDefault();
                handleCreateTab();
            } else if (e.key === "ArrowRight") {
                e.preventDefault();
                const idx = tabs.findIndex(t => t.id === activeTabId);
                const next = tabs[(idx + 1) % tabs.length];
                if (next) handleSwitchTab(next.id);
            } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                const idx = tabs.findIndex(t => t.id === activeTabId);
                const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
                if (prev) handleSwitchTab(prev.id);
            }
        }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId, handleCreateTab, handleSwitchTab]);

  return (
    <AppShell className="overflow-hidden">
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {!zen && (
          <Header 
            id={id}
            serverStatus={transport.serverStatus}
            connectionMessage={transport.connectionMessage}
            roleLabel={roleLabel}
            compactAvatars={compactAvatars}
            userActiveTabs={userActiveTabs}
            getTabName={getTabName}
            copyRoomId={() => { navigator.clipboard.writeText(id || ""); toast.success("Room ID copied"); }}
            copyCode={() => { navigator.clipboard.writeText(activeTab?.code || ""); toast.success("Code copied"); }}
            toggleEditable={toggleEditable}
            canEditCode={canEditCode}
            setShowParticipants={setShowParticipants}
            fontSizeChange={fontSizeChange}
            setWrapLines={setWrapLines}
            wrapLines={wrapLines}
            setZen={setZen}
            leaveRoom={() => navigate("/")}
          />
        )}

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
          <TabBar 
            tabs={tabs}
            activeTabId={activeTabId}
            handleSwitchTab={handleSwitchTab}
            handleCloseTab={handleCloseTab}
            handleCreateTab={handleCreateTab}
            followingUser={followingUser}
            renamingTabId={renamingTabId}
            setRenamingTabId={setRenamingTabId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            handleRenameTab={handleRenameTab}
            isOwner={isOwner}
            myPermissions={myPermissions}
            zen={zen}
          />

          <div className="relative flex-1 min-h-0 overflow-hidden group/editor">
            {zen && (
              <Button
                className="absolute right-4 top-4 z-10 opacity-0 transition group-hover/editor:opacity-100"
                onClick={() => setZen(false)}
                size="sm"
                variant="secondary"
              >
                <FiMinimize2 className="mr-2" /> Exit Zen
              </Button>
            )}
            
            <div className={cn(
                "h-full transition-all duration-300",
                !canUserEditTab(myPermissions, activeTabId, isOwner) && "grayscale-[0.5] opacity-90",
                followingUser && "ring-2 ring-primary ring-inset ring-opacity-50"
            )}>
                <EditorWrapper 
                  activeTabId={activeTabId}
                  currentEditor={transport.currentEditor}
                  editable={canUserEditTab(myPermissions, activeTabId, isOwner) && canEditCode}
                  fontSize={fontSize}
                  initialCode={activeTab?.code || ""}
                  onCodeChange={(code) => {
                      handleCodeChangeLocal(code, activeTabId);
                      transport.emitCodeChange(activeTabId, code);
                  }}
                  roomId={id || ""}
                  setCurrentEditor={transport.setCurrentEditor}
                  socketRef={transport.socketRef}
                  wrap={wrapLines}
                />
            </div>
            
            {followingUser && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-primary px-3 py-1.5 rounded-full text-primary-foreground text-xs font-medium shadow-lg animate-in slide-in-from-bottom-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground"></span>
                    </span>
                    Following {followingUser}
                    <button 
                        onClick={() => setFollowingUser(null)}
                        className="ml-1 hover:underline underline-offset-2"
                    >
                        Stop
                    </button>
                </div>
            )}

            {!canUserEditTab(myPermissions, activeTabId, isOwner) && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[1px] pointer-events-none">
                    <div className="bg-card border shadow-xl px-4 py-2 rounded-full text-xs font-medium animate-in zoom-in-95 duration-200">
                        Read-only access for this tab
                    </div>
                </div>
            )}
          </div>
        </div>

        {showParticipants && (
          <ParticipantsPanel 
            setShowParticipants={setShowParticipants}
            sortedClients={transport.clients}
            permissions={permissions}
            userName={userName}
            roomCreator={transport.roomCreator}
            currentEditor={transport.currentEditor}
            getTabName={getTabName}
            userActiveTabs={userActiveTabs}
            followingUser={followingUser}
            toggleFollow={toggleFollow}
            isOwner={isOwner}
            grantEditor={grantEditor}
            updatePermissions={updatePermissions}
            tabs={tabs}
          />
        )}
      </div>
    </AppShell>
  );
}
