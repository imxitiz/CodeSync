import { Crown, Pencil } from "lucide-react";

type OwnerRepresentationProps = {
  /** The username of the room creator/owner */
  roomCreator: string | null;
  /** The username of the current participant */
  username: string;
  /** Whether this user is currently editing */
  isEditor: boolean;
};

/**
 * Visual indicator for owner and editor status in the participant list.
 * Shows a crown for the owner and a pencil for the editor.
 * Uses sidebar-themed colors.
 */
export default function OwnerRepresentation({
  roomCreator,
  username,
  isEditor,
}: OwnerRepresentationProps) {
  const isOwner = roomCreator && username === roomCreator;

  return (
    <div className="relative">
      {isOwner && (
        <span
          className="-left-1 -top-1 pointer-events-none absolute inline-flex size-4 items-center justify-center rounded-full bg-warning text-warning-foreground shadow-sm ring-1 ring-border"
          title="Owner"
        >
          <Crown className="size-3" />
        </span>
      )}
      {isEditor && !isOwner && (
        <span
          className="-left-1 -bottom-1 pointer-events-none absolute inline-flex size-4 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-border"
          title="Editor"
        >
          <Pencil className="size-3.5 p-px" />
        </span>
      )}
    </div>
  );
}
