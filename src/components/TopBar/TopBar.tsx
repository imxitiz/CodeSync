import {
  Check,
  Copy,
  Crown,
  Eye,
  EyeOff,
  LogOut,
  MoreVertical,
  Pencil,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Avatar from "react-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type TopBarClient = {
  socketId: string;
  username: string;
};

export type TopBarProps = {
  roomId: string | null | undefined;
  userName: string;
  connectionStatus: ConnectionStatus;
  connectionMessage: string;
  serverUrl: string;
  clients: TopBarClient[];
  roomCreator: string | null;
  currentEditor: string;
  permissions: Record<string, { canEdit: boolean }>;
  fontSize: number;
  wrapLines: boolean;
  zen: boolean;
  followingUser: string | null;
  copied: boolean;
  onCopyInviteLink: () => void;
  onFontSizeChange: (delta: number) => void;
  onToggleWrap: () => void;
  onCopyCode: () => void;
  onToggleEdit: () => void;
  onToggleParticipants: () => void;
  onToggleZen: () => void;
  onLeave: () => void;
  onStopFollowing: () => void;
  onFollowUser: (username: string) => void;
  onGrantEdit: (username: string) => void;
  canEdit: boolean;
  isOwner: boolean;
};

export default function TopBar({
  roomId,
  userName,
  connectionStatus,
  connectionMessage,
  serverUrl,
  clients,
  roomCreator,
  currentEditor,
  permissions,
  wrapLines,
  zen,
  followingUser,
  copied,
  onCopyInviteLink,
  onFontSizeChange,
  onToggleWrap,
  onCopyCode,
  onToggleEdit,
  onToggleParticipants,
  onToggleZen,
  onLeave,
  onStopFollowing,
  canEdit,
  isOwner,
  onFollowUser,
  onGrantEdit,
}: TopBarProps) {
  const maxAvatars = 5;
  const visibleClients = clients.slice(0, maxAvatars);
  const extraCount = Math.max(0, clients.length - visibleClients.length);
  const totalParticipants = clients.length;

  const truncatedId =
    roomId && roomId.length > 12 ? `${roomId.slice(0, 8)}…` : roomId;

  const isCurrentEditor = currentEditor === userName;
  const canTakeEdit = canEdit && currentEditor !== "";
  const showEditToggle =
    isCurrentEditor || (isOwner && currentEditor !== "") || canTakeEdit;

  return (
    <TooltipProvider delayDuration={200}>
      <header className="sticky top-0 z-35 flex h-11 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-3">
        {/* ── Zone 1: Identity (left) ── */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label={`Room ${roomId}. Click to copy invite link.`}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-secondary px-2 py-1 font-mono text-[11px] text-secondary-foreground transition-colors hover:bg-secondary/80"
            onClick={onCopyInviteLink}
            title="Click to copy invite link"
            type="button"
          >
            {truncatedId}
            {copied ? (
              <Check className="size-3 text-success" />
            ) : (
              <Copy className="size-3 opacity-50" />
            )}
          </button>

          <div className="hidden items-center gap-1.5 sm:flex">
            <span
              className="max-w-[120px] truncate text-muted-foreground text-xs"
              title={userName}
            >
              {userName}
            </span>
            <StatusDot
              message={connectionMessage}
              serverUrl={serverUrl}
              status={connectionStatus}
            />
          </div>
        </div>

        {/* ── Zone 2: Presence (center, hidden on mobile) ── */}
        <div className="hidden min-w-0 flex-1 items-center justify-center sm:flex">
          <div className="flex items-center gap-1">
            {visibleClients.map(({ socketId, username }) => {
              const isMe = username === userName;
              const crown = username === roomCreator;
              const userPerms = permissions[username] || { canEdit: false };
              const pencil = username === currentEditor && userPerms.canEdit;
              const handleDoubleClick = () => {
                if (isMe) return;
                if (isOwner) {
                  onGrantEdit(username);
                } else {
                  onFollowUser(username);
                }
              };
              return (
                <div className="relative" key={socketId}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        onDoubleClick={handleDoubleClick}
                        style={{ cursor: isMe ? "default" : "pointer" }}
                      >
                        <Avatar
                          fgColor="var(--foreground)"
                          name={username}
                          round="8px"
                          size="28"
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span>{username}</span>
                      {crown && " (owner)"}
                      {pencil && " (editing)"}
                      {isMe && " (you)"}
                      {!isMe && (
                        <span className="text-muted-foreground">
                          {" "}
                          — dbl-click to {isOwner ? "grant edit" : "follow"}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  {isMe && (
                    <span
                      className="-bottom-0.5 -right-0.5 absolute size-2.5 rounded-full border-2 border-card bg-primary"
                      title="You"
                    />
                  )}
                  {crown && (
                    <span
                      className="-right-1 -top-1 pointer-events-none absolute inline-flex size-4 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-sm ring-1 ring-border"
                      title="Owner"
                    >
                      <Crown className="size-2.5" />
                    </span>
                  )}
                  {pencil && (
                    <span
                      className="-left-1 -bottom-1 pointer-events-none absolute inline-flex size-4 items-center justify-center rounded-full bg-success text-success-foreground shadow-sm ring-1 ring-border"
                      title="Editor"
                    >
                      <Pencil className="size-2.5" />
                    </span>
                  )}
                </div>
              );
            })}
            {extraCount > 0 && (
              <button
                aria-label={`+${extraCount} more participants. Show all.`}
                className="ms-1 cursor-pointer rounded-md border bg-background px-1.5 py-0.5 text-foreground text-xs hover:bg-accent"
                onClick={onToggleParticipants}
                title="Show all participants"
                type="button"
              >
                +{extraCount}
              </button>
            )}
            <button
              aria-label={`${totalParticipants} participants. Open participants panel.`}
              className="ms-1 cursor-pointer rounded-full border bg-background px-2 py-0.5 text-foreground text-xs hover:bg-accent"
              onClick={onToggleParticipants}
              title="Open participants"
              type="button"
            >
              <Users className="mr-1 inline size-3" />
              {totalParticipants}
            </button>
          </div>
        </div>

        {/* ── Zone 3: Actions (right) ── */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {/* Group A: Editor controls */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Increase font size"
                  onClick={() => onFontSizeChange(2)}
                  size="icon"
                  variant="ghost"
                >
                  <ZoomIn className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Increase font size</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Decrease font size"
                  className="mr-2"
                  onClick={() => onFontSizeChange(-2)}
                  size="icon"
                  variant="ghost"
                >
                  <ZoomOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Decrease font size</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={
                    wrapLines ? "Disable line wrap" : "Enable line wrap"
                  }
                  className="hidden sm:inline-flex mx-4 px-2"
                  onClick={onToggleWrap}
                  size="icon"
                  variant={wrapLines ? "secondary" : "ghost"}
                >
                  <span className="font-medium">
                    {wrapLines ? "Wrap:On" : "Wrap:Off"}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle line wrap</TooltipContent>
            </Tooltip>
          </div>

          <Separator />

          {/* Group B: Code actions */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Copy code"
                  onClick={onCopyCode}
                  size="icon"
                  variant="ghost"
                >
                  <Copy className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy code</TooltipContent>
            </Tooltip>

            {showEditToggle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={
                      isCurrentEditor
                        ? "Release editing control"
                        : "Take editing control"
                    }
                    onClick={onToggleEdit}
                    size="icon"
                    variant={isCurrentEditor ? "secondary" : "default"}
                  >
                    {isCurrentEditor ? (
                      <Eye className="size-4" />
                    ) : (
                      <Pencil className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isCurrentEditor ? "Release control" : "Take control"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <Separator />

          {/* Group C: Overflow — visible on desktop, collapsed to ⋯ on tablet/mobile */}
          <div className="hidden items-center gap-0.5 lg:flex">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Open participants"
                  onClick={onToggleParticipants}
                  size="icon"
                  variant="ghost"
                >
                  <Users className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>People</TooltipContent>
            </Tooltip>

            {followingUser && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={`Stop following ${followingUser}`}
                    onClick={onStopFollowing}
                    size="icon"
                    variant="secondary"
                  >
                    <Eye className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop following {followingUser}</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={zen ? "Exit zen mode" : "Enter zen mode"}
                  onClick={onToggleZen}
                  size="icon"
                  variant={zen ? "secondary" : "ghost"}
                >
                  <EyeOff className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {zen ? "Exit Zen mode" : "Enter Zen mode"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Leave room"
                  onClick={onLeave}
                  size="icon"
                  variant="destructive"
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave room</TooltipContent>
            </Tooltip>
          </div>

          {/* Mobile/tablet overflow ⋯ button */}
          <div className="lg:hidden">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label="More actions"
                      size="icon"
                      variant="ghost"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More actions</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                {/* Mobile-only: participant count trigger */}
                <DropdownMenuItem
                  className="sm:hidden"
                  onClick={onToggleParticipants}
                >
                  <Users className="size-4" />
                  <span>
                    People{" "}
                    <span className="text-muted-foreground">
                      ({totalParticipants})
                    </span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="sm:hidden" />
                <DropdownMenuItem onClick={onToggleParticipants}>
                  <Users className="size-4" />
                  <span>Participants</span>
                </DropdownMenuItem>
                {followingUser && (
                  <DropdownMenuItem onClick={onStopFollowing}>
                    <Eye className="size-4" />
                    <span>Stop following {followingUser}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onToggleZen}>
                  <EyeOff className="size-4" />
                  <span>{zen ? "Exit Zen mode" : "Enter Zen mode"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLeave}>
                  <LogOut className="size-4" />
                  <span>Leave room</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

function Separator() {
  return (
    <div
      aria-hidden="true"
      className="mx-1.5 hidden h-5 w-px bg-border sm:block"
    />
  );
}

function StatusDot({
  status,
  message,
  serverUrl,
}: {
  status: ConnectionStatus;
  message: string;
  serverUrl: string;
}) {
  const tooltipText =
    status === "connected"
      ? `Connected to ${serverUrl}`
      : status === "connecting"
        ? `Connecting to ${serverUrl}…`
        : message;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-live="polite"
          className="inline-flex shrink-0 items-center"
          title={tooltipText}
        >
          {status === "connected" ? (
            <span className="size-2 rounded-full bg-success dark:bg-success" />
          ) : status === "connecting" ? (
            <span className="relative inline-flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-muted opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-muted" />
            </span>
          ) : (
            <span className="relative inline-flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-destructive" />
            </span>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span>{tooltipText}</span>
      </TooltipContent>
    </Tooltip>
  );
}
