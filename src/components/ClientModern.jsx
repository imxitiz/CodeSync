import Avatar from "react-avatar";
import { FaCrown } from "react-icons/fa";
import { FiEdit2 } from "react-icons/fi";
import { useRef } from "react";
import randomColor from "randomcolor";

export default function ClientModern({
  username,
  roomcreator,
  currentEditor,
  canGrantEdit = false,
}) {
  const colorRef = useRef(randomColor());
  const isOwner = username === roomcreator;
  const isEditor = username === currentEditor;

  return (
    <div
      className={[
        "group relative flex items-center justify-between rounded-md border bg-card/60 px-3 py-2 text-card-foreground shadow-xs transition-colors",
        canGrantEdit ? "cursor-pointer hover:bg-accent/50" : "hover:bg-accent/40",
      ].join(" ")}
      role="listitem"
      aria-label={`${username}${isOwner ? " (owner)" : ""}${isEditor ? " (editor)" : ""}`}
      title={
        canGrantEdit
          ? "Click to grant editor"
          : isEditor
          ? "Currently the editor"
          : isOwner
          ? "Room owner"
          : "Participant"
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar
            name={username}
            size={40}
            round="12px"
            color={colorRef.current}
            fgColor="#000"
          />
          {isOwner && (
            <span
              className="absolute -right-1 -top-1 inline-flex items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-1 ring-border shadow-sm"
              aria-label="Owner"
              title="Owner"
            >
              <FaCrown className="size-3.5 p-[1px]" />
            </span>
          )}
          {isEditor && (
            <span
              className="absolute -left-1 -bottom-1 inline-flex items-center justify-center rounded-full bg-emerald-400 text-emerald-950 ring-1 ring-border shadow-sm"
              aria-label="Editor"
              title="Editor"
            >
              <FiEdit2 className="size-3.5 p-[1px]" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{username}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isOwner ? "Owner" : "Participant"}
          </p>
        </div>
      </div>
    </div>
  );
}
