import Avatar from "react-avatar";
import { FaRegCopy } from "react-icons/fa6";
import { FiEdit2, FiUsers, FiLogOut } from "react-icons/fi";
import { MdTextDecrease, MdTextIncrease } from "react-icons/md";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";
import type { Client } from "../types";

type HeaderProps = {
  id: string | undefined;
  serverStatus: string;
  connectionMessage: string;
  roleLabel: string;
  compactAvatars: { slice: Client[]; extra: number };
  userActiveTabs: Record<string, string>;
  getTabName: (tabId: string) => string;
  copyRoomId: () => void;
  copyCode: () => void;
  toggleEditable: () => void;
  canEditCode: boolean;
  setShowParticipants: (show: boolean) => void;
  fontSizeChange: (change: number) => void;
  setWrapLines: (update: (val: boolean) => boolean) => void;
  wrapLines: boolean;
  setZen: (zen: boolean) => void;
  leaveRoom: () => void;
};

export const Header = ({
  id,
  serverStatus,
  connectionMessage,
  roleLabel,
  compactAvatars,
  userActiveTabs,
  getTabName,
  copyRoomId,
  copyCode,
  toggleEditable,
  canEditCode,
  setShowParticipants,
  fontSizeChange,
  setWrapLines,
  wrapLines,
  setZen,
  leaveRoom,
}: HeaderProps) => {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-2 shrink-0 border-b bg-card/95 backdrop-blur">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <span
            className={cn(
              "size-2 rounded-full",
              serverStatus === "connected" ? "bg-primary" : "bg-muted-foreground"
            )}
          />
          <span>{connectionMessage}</span>
          <span className="hidden text-muted-foreground/60 sm:inline">
            · {roleLabel}
          </span>
        </div>
        <div className="truncate font-mono text-xs sm:text-sm">{id}</div>
      </div>

      <div className="flex items-center gap-1">
        {compactAvatars.slice.map((client) => (
          <Avatar
            key={client.socketId}
            name={client.username}
            round
            size="28"
            title={`${client.username} · ${getTabName(
              userActiveTabs[client.username] || ""
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
  );
};
