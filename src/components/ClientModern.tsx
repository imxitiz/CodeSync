import randomColor from "randomcolor";
import { useRef } from "react";
import Avatar from "react-avatar";
import { FaCrown } from "react-icons/fa";
import { FiEdit2 } from "react-icons/fi";

export type ClientModernProps = {
  username: string;
  roomcreator: string | null;
  currentEditor: string;
  canGrantEdit?: boolean;
};

export default function ClientModern({
  username,
  roomcreator,
  currentEditor,
  canGrantEdit = false,
}: ClientModernProps) {
  const colorRef = useRef<string>(randomColor());
  const isOwner = username === roomcreator;
  const isEditor = username === currentEditor;

  let titleText: string;
  if (canGrantEdit) {
    titleText = "Click to grant editor";
  } else if (isEditor) {
    titleText = "Currently the editor";
  } else if (isOwner) {
    titleText = "Room owner";
  } else {
    titleText = "Participant";
  }

  return (
    <li
      aria-label={`${username}${isOwner ? " (owner)" : ""}${
        isEditor ? " (editor)" : ""
      }`}
      className={[
        "group relative flex items-center justify-between rounded-md border bg-card/60 px-3 py-2 text-card-foreground shadow-xs transition-colors",
        canGrantEdit
          ? "cursor-pointer hover:bg-accent/50"
          : "hover:bg-accent/40",
      ].join(" ")}
      title={titleText}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar
            color={colorRef.current}
            fgColor="#000"
            name={username}
            round="12px"
            size="40"
          />
          {isOwner && (
            <span
              className="-right-1 -top-1 absolute inline-flex items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm ring-1 ring-border"
              title="Owner"
            >
              <FaCrown className="size-3.5 p-[1px]" />
            </span>
          )}
          {isEditor && (
            <span
              className="-left-1 -bottom-1 absolute inline-flex items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-sm ring-1 ring-border"
              title="Editor"
            >
              <FiEdit2 className="size-3.5 p-[1px]" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{username}</p>
          <p className="truncate text-muted-foreground text-xs">
            {isOwner ? "Owner" : "Participant"}
          </p>
        </div>
      </div>
    </li>
  );
}
