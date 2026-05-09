import { FiPlus, FiX } from "react-icons/fi";
import { cn } from "../../../lib/utils";
import type { EditorTab, UserPermissions } from "../types";
import toast from "react-hot-toast";

type TabBarProps = {
  tabs: EditorTab[];
  activeTabId: string;
  handleSwitchTab: (id: string) => void;
  handleCloseTab: (id: string) => void;
  handleCreateTab: () => void;
  followingUser: string | null;
  renamingTabId: string | null;
  setRenamingTabId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (val: string) => void;
  handleRenameTab: (id: string, name: string) => void;
  isOwner: boolean;
  myPermissions: UserPermissions;
  zen: boolean;
};

export const TabBar = ({
  tabs,
  activeTabId,
  handleSwitchTab,
  handleCloseTab,
  handleCreateTab,
  followingUser,
  renamingTabId,
  setRenamingTabId,
  renameValue,
  setRenameValue,
  handleRenameTab,
  isOwner,
  myPermissions,
  zen,
}: TabBarProps) => {
  return (
    <div
      className={cn(
        "flex min-h-10 items-end gap-1 overflow-x-auto px-2 pt-1 bg-card/95 backdrop-blur",
        zen && "px-4"
      )}
    >
      {tabs.map((tab) => {
        const isActiveTab = tab.id === activeTabId;
        const isFollowingLocked = Boolean(followingUser && !isActiveTab);
        
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
            onAuxClick={(e) => {
              if (e.button === 1) { // Middle click
                e.preventDefault();
                handleCloseTab(tab.id);
              }
            }}
            title={
              isFollowingLocked
                ? `Following ${followingUser}. Turn off follow to switch tabs.`
                : "Click to switch · double click to rename · middle click to close"
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
  );
};
