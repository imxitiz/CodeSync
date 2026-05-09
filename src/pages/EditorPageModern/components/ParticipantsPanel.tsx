import Avatar from "react-avatar";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import type { Client, UserPermissions, EditorTab } from "../types";

type ParticipantsPanelProps = {
  setShowParticipants: (show: boolean) => void;
  sortedClients: Client[];
  permissions: Record<string, UserPermissions>;
  userName: string;
  roomCreator: string | null;
  currentEditor: string;
  getTabName: (tabId: string) => string;
  userActiveTabs: Record<string, string>;
  followingUser: string | null;
  toggleFollow: (username: string) => void;
  isOwner: boolean;
  grantEditor: (username: string) => void;
  updatePermissions: (username: string, perms: UserPermissions) => void;
  tabs: EditorTab[];
};

export const ParticipantsPanel = ({
  setShowParticipants,
  sortedClients,
  permissions,
  userName,
  roomCreator,
  currentEditor,
  getTabName,
  userActiveTabs,
  followingUser,
  toggleFollow,
  isOwner,
  grantEditor,
  updatePermissions,
  tabs,
}: ParticipantsPanelProps) => {
  return (
    <div
      aria-labelledby="participants-title"
      aria-modal="true"
      className="absolute inset-0 z-50 flex items-start justify-end"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-background/40 backdrop-blur-[2px] transition-opacity"
        onClick={() => setShowParticipants(false)}
      />
      <aside className="relative h-full w-full max-w-sm border-l bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-semibold text-lg" id="participants-title">
              Participants
            </h2>
            <p className="text-muted-foreground text-xs">
              {sortedClients.length} people connected
            </p>
          </div>
          <Button
            onClick={() => setShowParticipants(false)}
            size="sm"
            variant="ghost"
            className="rounded-full h-8 w-8 p-0"
          >
            <span className="sr-only">Close</span>
            ✕
          </Button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-73px)] px-2 py-4">
          <div className="space-y-1">
            {sortedClients.map(({ socketId, username }) => {
              const userPerms = permissions[username] || {
                  canEdit: false,
                  canCreateTab: false,
                  canDeleteTab: false,
                  canRenameTab: false,
              };
              const isMe = username === userName;
              const isParticipantOwner = username === roomCreator;
              const isParticipantEditor = username === currentEditor;
              const activeTabId = userActiveTabs[username] || "";
              const participantTabName = getTabName(activeTabId);

              return (
                <div
                  className="group rounded-xl p-3 transition-all hover:bg-accent/50"
                  key={socketId}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar name={username} round size="40" className="shadow-sm" />
                      {isParticipantEditor && (
                        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground border-2 border-card">
                          ✎
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm truncate max-w-[120px]">
                          {username}
                        </span>
                        {isMe && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            You
                          </span>
                        )}
                        {isParticipantOwner && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                            Owner
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs truncate mt-0.5">
                        {participantTabName ? `Working on ${participantTabName}` : "Idle"}
                      </p>
                    </div>
                    
                    {!isMe && (
                      <button
                        className={cn(
                          "h-8 w-8 flex items-center justify-center rounded-full border transition-all",
                          followingUser === username
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                        onClick={() => toggleFollow(username)}
                        title={followingUser === username ? "Stop following" : "Follow tab"}
                        type="button"
                      >
                        {followingUser === username ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                      </button>
                    )}
                  </div>

                  {isOwner && !isParticipantOwner && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-[56px]">
                      {!userPerms.canEdit && (
                        <button
                          className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
                          onClick={() => grantEditor(username)}
                          type="button"
                        >
                          Make Editor
                        </button>
                      )}
                      
                      {userPerms.canEdit && (
                        <div className="flex flex-wrap gap-1">
                           {(
                            [
                              ["canEdit", "Edit"],
                              ["canCreateTab", "Create"],
                              ["canDeleteTab", "Delete"],
                              ["canRenameTab", "Rename"],
                            ] as const
                          ).map(([key, label]) => (
                            <button
                              aria-pressed={userPerms[key]}
                              className={cn(
                                "rounded-lg border px-2.5 py-1 text-[11px] transition-all",
                                userPerms[key]
                                  ? "bg-secondary text-secondary-foreground border-secondary"
                                  : "text-muted-foreground border-dashed hover:border-solid hover:bg-accent"
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
                  )}
                  
                  {/* Tab specific permissions (only for editors) */}
                  {isOwner && !isParticipantOwner && userPerms.canEdit && (
                      <div className="mt-2 pl-[56px] space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Restricted Tabs</p>
                          <div className="flex flex-wrap gap-1">
                              {tabs.map(tab => {
                                  const isAllowed = !userPerms.allowedTabs || userPerms.allowedTabs.includes(tab.id);
                                  return (
                                      <button
                                          key={tab.id}
                                          onClick={() => {
                                              const currentAllowed = userPerms.allowedTabs || tabs.map(t => t.id);
                                              const nextAllowed = isAllowed 
                                                ? currentAllowed.filter(id => id !== tab.id)
                                                : [...currentAllowed, tab.id];
                                              
                                              updatePermissions(username, {
                                                  ...userPerms,
                                                  allowedTabs: nextAllowed.length === tabs.length ? undefined : nextAllowed
                                              });
                                          }}
                                          className={cn(
                                              "px-2 py-0.5 rounded text-[10px] transition-colors",
                                              isAllowed 
                                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                                          )}
                                      >
                                          {tab.name}
                                      </button>
                                  )
                              })}
                          </div>
                      </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
};
