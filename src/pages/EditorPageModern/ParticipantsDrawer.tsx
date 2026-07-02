import {
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  FolderLock,
  Lock,
  Pencil,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import Avatar from "react-avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import OwnerRepresentation from "./representation-icon";
import type { EditorTab, TabPermissions, UserPermissions } from "./types";

type Participant = {
  socketId: string;
  username: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCopyInvite: () => void;
  onDone: () => void;
  participants: Participant[];
  currentUser: string;
  currentEditor: string;
  roomCreator: string | null;
  isOwner: boolean;
  followingUser: string | null;
  onFollow: (username: string) => void;
  onGrantEditor: (username: string) => void;
  openPermDialog: string | null;
  onOpenPermDialog: (username: string | null) => void;
  getActiveTabName: (username: string) => string | undefined;
  userPermissions: Record<string, UserPermissions>;
  onUpdatePermissions: (username: string, perms: UserPermissions) => void;
  tabs: EditorTab[];
  tabPermissions: TabPermissions;
  emitTabPermissionGrant: (
    tabId: string,
    targetUser: string,
    level: "EDITOR" | "VIEWER",
  ) => void;
  emitTabPermissionRevoke: (tabId: string, targetUser: string) => void;
  allowEditRequests: boolean;
  emitEditRequestsToggle: (enabled: boolean) => void;
};

export default function ParticipantsDrawer({
  open,
  onClose,
  onCopyInvite,
  onDone,
  participants,
  currentUser,
  currentEditor,
  roomCreator,
  isOwner,
  followingUser,
  onFollow,
  onGrantEditor,
  openPermDialog,
  onOpenPermDialog,
  getActiveTabName,
  userPermissions,
  onUpdatePermissions,
  tabs,
  tabPermissions,
  emitTabPermissionGrant,
  emitTabPermissionRevoke,
  allowEditRequests,
  emitEditRequestsToggle,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  const handleTogglePerm = (username: string) => {
    onOpenPermDialog(openPermDialog === username ? null : username);
  };

  if (!open) return null;

  return (
    <div aria-hidden={!open} className="fixed inset-0 z-50">
      {open && (
        <div
          className="absolute inset-0 bg-background/50"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          "absolute inset-y-0 right-0 flex h-full flex-col border-l bg-sidebar shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-label="Participants"
        aria-labelledby={titleId}
        aria-modal="true"
        style={{ width: "360px", minWidth: "280px", maxWidth: "480px" }}
      >
        {/* Resize handle — left edge of the drawer */}
        <div
          onMouseDown={(e) => {
            const aside = e.currentTarget.closest("aside");
            if (!aside) return;
            const startX = e.clientX;
            const startWidth = aside.offsetWidth;

            const onMouseMove = (ev: MouseEvent) => {
              const delta = startX - ev.clientX;
              const newWidth = Math.min(480, Math.max(280, startWidth + delta));
              aside.style.width = `${newWidth}px`;
            };

            const onMouseUp = () => {
              document.removeEventListener("mousemove", onMouseMove);
              document.removeEventListener("mouseup", onMouseUp);
            };

            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
          }}
          className="absolute top-0 bottom-0 -left-1.5 z-10 w-3 cursor-ew-resize rounded-sm transition-colors hover:bg-primary/20"
          title="Drag to resize"
        />

        <header className="flex shrink-0 items-center justify-between border-b border-sidebar px-4 py-3">
          <h2
            id={titleId}
            className="font-semibold text-sidebar-foreground text-sm"
          >
            Participants ({participants.length})
          </h2>
          <button
            ref={closeRef}
            aria-label="Close participants drawer"
            className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Owner controls — allow edit requests toggle */}
        {isOwner && (
          <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-2">
            <span className="text-xs text-sidebar-foreground/70">
              Allow edit requests
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={allowEditRequests}
              onClick={() => emitEditRequestsToggle(!allowEditRequests)}
              className={[
                "relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full transition-colors",
                allowEditRequests ? "bg-primary" : "bg-sidebar-foreground/20",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform",
                  allowEditRequests ? "translate-x-4" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {participants.map(({ socketId, username }) => {
            const isMe = username === currentUser;
            const isEditor = username === currentEditor;
            const hasPendingRequest = Object.values(tabPermissions).some(
              (entry) => entry?.[username] === "REQUESTED",
            );
            return (
              <div key={socketId}>
                <div className="flex items-center gap-2">
                  <div
                    className={[
                      "flex-1",
                      isOwner && !isMe ? "cursor-pointer" : "",
                    ].join(" ")}
                    onClick={
                      isOwner && !isMe
                        ? () => onGrantEditor(username)
                        : undefined
                    }
                    role={isOwner && !isMe ? "button" : undefined}
                    tabIndex={isOwner && !isMe ? 0 : undefined}
                    onKeyDown={
                      isOwner && !isMe
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onGrantEditor(username);
                            }
                          }
                        : undefined
                    }
                  >
                    <div
                      className={[
                        "group flex items-center justify-between rounded-md border px-3 py-2 text-sidebar-foreground shadow-xs transition-colors",
                        isMe
                          ? "border-sidebar-primary/50 bg-sidebar-primary/10 ring-1 ring-sidebar-primary/30"
                          : "border-sidebar-border bg-sidebar-accent/50",
                        isOwner && !isMe
                          ? "hover:bg-sidebar-accent/70"
                          : "hover:bg-sidebar-accent/60",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          <AvatarPreset name={username} />
                          <OwnerRepresentation
                            roomCreator={roomCreator}
                            username={username}
                            isEditor={isEditor}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">
                            {username}
                            {isMe && (
                              <span className="ml-1.5 rounded-full bg-sidebar-primary/15 px-1.5 py-0.5 font-medium text-sidebar-primary text-xs">
                                You
                              </span>
                            )}
                          </p>
                          <p className="truncate text-sidebar-foreground/70 text-xs">
                            {isMe
                              ? "You"
                              : isEditor
                                ? "Editing"
                                : "Participant"}
                            {getActiveTabName(username)
                              ? ` · ${getActiveTabName(username)}`
                              : ""}
                            {hasPendingRequest && (
                              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1 py-0.5 text-[9px] text-warning-foreground">
                                <Clock className="size-2" />
                                pending
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isMe && (
                      <button
                        aria-label={
                          followingUser === username
                            ? "Stop following"
                            : `Follow ${username}`
                        }
                        className={[
                          "inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                          followingUser === username
                            ? "bg-sidebar-primary/15 text-sidebar-primary"
                            : "",
                        ].join(" ")}
                        type="button"
                        onClick={() => onFollow(username)}
                      >
                        <Eye className="size-3.5" />
                      </button>
                    )}
                    {isOwner && !isMe && (
                      <button
                        aria-label={`Manage permissions for ${username}`}
                        aria-pressed={openPermDialog === username}
                        className={[
                          "inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                          openPermDialog === username
                            ? "bg-sidebar-primary/15 text-sidebar-primary"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                        ].join(" ")}
                        type="button"
                        onClick={() => handleTogglePerm(username)}
                      >
                        <span
                          aria-hidden="true"
                          className="text-sm leading-none"
                        >
                          ⚙
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {isOwner && !isMe && openPermDialog === username && (
                  <PermissionPanel
                    username={username}
                    userPermissions={userPermissions}
                    onUpdatePermissions={onUpdatePermissions}
                    tabs={tabs}
                    tabPermissions={tabPermissions}
                    emitTabPermissionGrant={emitTabPermissionGrant}
                    emitTabPermissionRevoke={emitTabPermissionRevoke}
                  />
                )}
              </div>
            );
          })}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-sidebar-border px-4 py-3">
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-1.5 font-medium text-xs text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            onClick={onCopyInvite}
            type="button"
            aria-label="Copy invite link"
          >
            Copy Invite Link
          </button>
          <button
            className="inline-flex cursor-pointer items-center rounded-md bg-sidebar-primary px-3 py-1.5 font-medium text-sidebar-primary-foreground text-xs transition-colors hover:bg-sidebar-primary/90 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            onClick={onDone}
            type="button"
            aria-label="Done"
          >
            Done
          </button>
        </footer>
      </aside>
    </div>
  );
}

function PermissionPanel({
  username,
  userPermissions,
  onUpdatePermissions,
  tabs,
  tabPermissions,
  emitTabPermissionGrant,
  emitTabPermissionRevoke,
}: {
  username: string;
  userPermissions: Record<string, UserPermissions>;
  onUpdatePermissions: (username: string, perms: UserPermissions) => void;
  tabs: EditorTab[];
  tabPermissions: TabPermissions;
  emitTabPermissionGrant: (
    tabId: string,
    targetUser: string,
    level: "EDITOR" | "VIEWER",
  ) => void;
  emitTabPermissionRevoke: (tabId: string, targetUser: string) => void;
}) {
  const [roomPermsOpen, setRoomPermsOpen] = useState(true);
  const [tabPermsOpen, setTabPermsOpen] = useState(false);

  const overriddenCount = tabs.filter(
    (t) => tabPermissions[t.id]?.[username],
  ).length;

  return (
    <div className="mt-1 ml-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 p-3">
      {/* Room-level permissions — collapsible */}
      <Collapsible open={roomPermsOpen} onOpenChange={setRoomPermsOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs transition-colors hover:bg-sidebar-accent/70"
          >
            {roomPermsOpen ? (
              <ChevronDown className="size-3 text-sidebar-foreground/50" />
            ) : (
              <ChevronRight className="size-3 text-sidebar-foreground/50" />
            )}
            <Shield className="size-3 text-sidebar-foreground/60" />
            <span className="font-medium text-sidebar-foreground/80">
              Room Permissions
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <PermToggle
              label="Can Edit Code"
              checked={userPermissions[username]?.canEdit ?? false}
              onChange={() =>
                onUpdatePermissions(username, {
                  ...(userPermissions[username] ?? {
                    canEdit: false,
                    canCreateTab: false,
                    canDeleteTab: false,
                    canRenameTab: false,
                  }),
                  canEdit: !(userPermissions[username]?.canEdit ?? false),
                })
              }
            />
            <PermToggle
              label="Can Create Tabs"
              checked={userPermissions[username]?.canCreateTab ?? false}
              onChange={() =>
                onUpdatePermissions(username, {
                  ...(userPermissions[username] ?? {
                    canEdit: false,
                    canCreateTab: false,
                    canDeleteTab: false,
                    canRenameTab: false,
                  }),
                  canCreateTab: !(
                    userPermissions[username]?.canCreateTab ?? false
                  ),
                })
              }
            />
            <PermToggle
              label="Can Delete Tabs"
              checked={userPermissions[username]?.canDeleteTab ?? false}
              onChange={() =>
                onUpdatePermissions(username, {
                  ...(userPermissions[username] ?? {
                    canEdit: false,
                    canCreateTab: false,
                    canDeleteTab: false,
                    canRenameTab: false,
                  }),
                  canDeleteTab: !(
                    userPermissions[username]?.canDeleteTab ?? false
                  ),
                })
              }
            />
            <PermToggle
              label="Can Rename Tabs"
              checked={userPermissions[username]?.canRenameTab ?? false}
              onChange={() =>
                onUpdatePermissions(username, {
                  ...(userPermissions[username] ?? {
                    canEdit: false,
                    canCreateTab: false,
                    canDeleteTab: false,
                    canRenameTab: false,
                  }),
                  canRenameTab: !(
                    userPermissions[username]?.canRenameTab ?? false
                  ),
                })
              }
            />
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1 text-xs transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              onClick={() =>
                onUpdatePermissions(username, {
                  canEdit: true,
                  canCreateTab: true,
                  canDeleteTab: true,
                  canRenameTab: true,
                })
              }
            >
              Grant All
            </button>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center rounded-md border border-sidebar-border bg-destructive/10 px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              onClick={() =>
                onUpdatePermissions(username, {
                  canEdit: false,
                  canCreateTab: false,
                  canDeleteTab: false,
                  canRenameTab: false,
                })
              }
            >
              Revoke All
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tab-level permissions — collapsible */}
      <Collapsible
        open={tabPermsOpen}
        onOpenChange={setTabPermsOpen}
        className="mt-2 border-t border-sidebar-border pt-2"
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs transition-colors hover:bg-sidebar-accent/70"
          >
            {tabPermsOpen ? (
              <ChevronDown className="size-3 text-sidebar-foreground/50" />
            ) : (
              <ChevronRight className="size-3 text-sidebar-foreground/50" />
            )}
            <FolderLock className="size-3 text-sidebar-foreground/60" />
            <span className="font-medium text-sidebar-foreground/80">
              Per-tab Access
            </span>
            {overriddenCount > 0 && (
              <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                {overriddenCount}/{tabs.length}
              </span>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-1">
            {tabs.map((tab) => {
              const rawLevel = tabPermissions[tab.id]?.[username];
              const level: "DEFAULT" | "EDITOR" | "VIEWER" =
                rawLevel === "EDITOR" || rawLevel === "VIEWER"
                  ? rawLevel
                  : "DEFAULT";
              return (
                <div
                  key={tab.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
                >
                  <span
                    className="truncate text-sidebar-foreground/70"
                    title={tab.name}
                  >
                    {tab.name}
                    {rawLevel === "REQUESTED" && (
                      <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-warning/15 px-1 py-0.5 text-[9px] text-warning-foreground">
                        <Clock className="size-2" />
                        requested
                      </span>
                    )}
                  </span>
                  <TabPermissionToggle
                    level={level}
                    inheritsLevel={
                      userPermissions[username]?.canEdit ? "EDITOR" : "VIEWER"
                    }
                    onChange={(newLevel) => {
                      if (newLevel === "DEFAULT") {
                        emitTabPermissionRevoke(tab.id, username);
                      } else {
                        emitTabPermissionGrant(tab.id, username, newLevel);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              className="inline-flex cursor-pointer items-center rounded-md border border-sidebar-border bg-sidebar-accent px-2 py-1 text-xs transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              onClick={() => {
                for (const tab of tabs) {
                  emitTabPermissionGrant(tab.id, username, "EDITOR");
                }
              }}
            >
              Grant All Tabs
            </button>
            <button
              type="button"
              className="inline-flex cursor-pointer items-center rounded-md border border-sidebar-border bg-destructive/10 px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              onClick={() => {
                for (const tab of tabs) {
                  emitTabPermissionRevoke(tab.id, username);
                }
              }}
            >
              Revoke All Tabs
            </button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function AvatarPreset({ name }: { name: string }) {
  return <Avatar name={name} round="12px" size="40" />;
}

function PermToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        className="cursor-pointer accent-primary"
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}

function TabPermissionToggle({
  level,
  inheritsLevel,
  onChange,
}: {
  level: "DEFAULT" | "EDITOR" | "VIEWER";
  inheritsLevel: "EDITOR" | "VIEWER";
  onChange: (level: "DEFAULT" | "EDITOR" | "VIEWER") => void;
}) {
  const effectiveLevel = level === "DEFAULT" ? inheritsLevel : level;
  const isOverridden = level !== "DEFAULT";

  const handleClick = () => {
    if (level === "DEFAULT") {
      onChange("EDITOR");
    } else if (level === "EDITOR") {
      onChange("VIEWER");
    } else {
      onChange("DEFAULT");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={[
        "inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
        effectiveLevel === "EDITOR"
          ? "bg-success/15 text-success hover:bg-success/25"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
        isOverridden ? "ring-1 ring-border" : "opacity-60",
      ].join(" ")}
      title={`Click to cycle. Currently: ${effectiveLevel}${isOverridden ? " (overridden)" : " (inherits)"}`}
    >
      {effectiveLevel === "EDITOR" ? (
        <Pencil className="size-2.5" />
      ) : (
        <Lock className="size-2.5" />
      )}
      <span>{isOverridden ? effectiveLevel : `inherits ${inheritsLevel}`}</span>
    </button>
  );
}
