import { Eye, Pencil, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import Avatar from "react-avatar";
import type { UserPermissions } from "./types";

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
  isOwner: boolean;
  followingUser: string | null;
  onFollow: (username: string) => void;
  onGrantEditor: (username: string) => void;
  openPermDialog: string | null;
  onOpenPermDialog: (username: string | null) => void;
  getActiveTabName: (username: string) => string | undefined;
  userPermissions: Record<string, UserPermissions>;
  onUpdatePermissions: (username: string, perms: UserPermissions) => void;
};

export default function ParticipantsDrawer({
  open,
  onClose,
  onCopyInvite,
  onDone,
  participants,
  currentUser,
  currentEditor,
  isOwner,
  followingUser,
  onFollow,
  onGrantEditor,
  openPermDialog,
  onOpenPermDialog,
  getActiveTabName,
  userPermissions,
  onUpdatePermissions,
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
          "absolute inset-y-0 right-0 flex w-[85vw] max-w-sm flex-col border-l bg-card shadow-xl transition-transform duration-200 sm:w-72",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-label="Participants"
        aria-labelledby={titleId}
        aria-modal="true"
      >
        <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 id={titleId} className="font-semibold text-foreground text-sm">
            Participants ({participants.length})
          </h2>
          <button
            ref={closeRef}
            aria-label="Close participants drawer"
            className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {participants.map(({ socketId, username }) => {
            const isMe = username === currentUser;
            const isEditor = username === currentEditor;
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
                        "group flex items-center justify-between rounded-md border px-3 py-2 text-card-foreground shadow-xs transition-colors",
                        isMe
                          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-card/60",
                        isOwner && !isMe
                          ? "hover:bg-accent/50"
                          : "hover:bg-accent/40",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          <AvatarPreset name={username} />
                          {isEditor && (
                            <span
                              className="-left-1 -bottom-1 pointer-events-none absolute inline-flex size-4 items-center justify-center rounded-full bg-success text-success-foreground shadow-sm ring-1 ring-border"
                              title="Editor"
                            >
                              <Pencil className="size-3.5 p-[1px]" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">
                            {username}
                            {isMe && (
                              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 font-medium text-primary text-xs">
                                You
                              </span>
                            )}
                          </p>
                          <p className="truncate text-muted-foreground text-xs">
                            {isMe
                              ? "You"
                              : isEditor
                                ? "Editing"
                                : "Participant"}
                            {getActiveTabName(username)
                              ? ` · ${getActiveTabName(username)}`
                              : ""}
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
                          "inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                          followingUser === username
                            ? "bg-primary/15 text-primary"
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
                          "inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
                          openPermDialog === username
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:text-foreground",
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
                  <div className="mt-1 ml-2 rounded-md border bg-background/50 p-3">
                    <p className="mb-2 font-medium text-xs">
                      Permissions for {username}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
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
                            canEdit: !(
                              userPermissions[username]?.canEdit ?? false
                            ),
                          })
                        }
                      />
                      <PermToggle
                        label="Can Create Tabs"
                        checked={
                          userPermissions[username]?.canCreateTab ?? false
                        }
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
                        checked={
                          userPermissions[username]?.canDeleteTab ?? false
                        }
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
                        checked={
                          userPermissions[username]?.canRenameTab ?? false
                        }
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
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center rounded-md border bg-background px-2 py-1 text-xs transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
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
                        className="inline-flex cursor-pointer items-center rounded-md border bg-destructive/10 px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-ring"
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
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3">
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 font-medium text-xs transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onCopyInvite}
            type="button"
            aria-label="Copy invite link"
          >
            Copy Invite Link
          </button>
          <button
            className="inline-flex cursor-pointer items-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring"
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
