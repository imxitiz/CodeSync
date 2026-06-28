import { Crown, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import Avatar from "react-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Participant = {
  socketId: string;
  username: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  participants: Participant[];
  onTransfer: (newOwner: string) => void;
  onDestroy: () => void;
};

export default function TransferOwnerDialog({
  open,
  onClose,
  participants,
  onTransfer,
  onDestroy,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const participantCount = useMemo(() => participants.length, [participants]);

  const handleTransfer = () => {
    if (!selected) return;
    onTransfer(selected);
    setSelected(null);
  };

  const handleDestroy = () => {
    onDestroy();
    setSelected(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelected(null);
    if (next !== open) {
      // If the open state changed by external trigger, let onClose handle it.
      // This keeps the controlled state in sync with the parent.
      if (!next) onClose();
    }
  };

  const isEmpty = participantCount === 0;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Crown className="size-4" />
            Leave room
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isEmpty
              ? "You are the only person in this room. Leaving will destroy it."
              : `Choose a new owner for this room before leaving, or destroy it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!isEmpty && (
          <div className="max-h-48 space-y-1 overflow-y-auto py-1">
            <p className="mb-2 font-medium text-muted-foreground text-xs">
              Select new owner
            </p>
            {participants.map((p) => (
              <button
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selected === p.username
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border bg-card/60 hover:bg-accent/40",
                )}
                key={p.socketId}
                onClick={() => setSelected(p.username)}
                type="button"
              >
                <Avatar name={p.username} round="6px" size="24" />
                <span className="truncate">{p.username}</span>
                {selected === p.username && (
                  <span className="ml-auto inline-flex items-center font-medium text-primary text-xs">
                    Selected
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row">
          <AlertDialogCancel onClick={onClose} type="button">
            Cancel
          </AlertDialogCancel>

          <Button
            className="flex items-center gap-1.5"
            disabled={isEmpty ? false : !selected}
            onClick={handleTransfer}
            variant="outline"
            type="button"
          >
            <Crown className="size-3.5" />
            {isEmpty ? "Leave" : "Transfer & Leave"}
          </Button>

          <AlertDialogAction
            className="flex items-center gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDestroy}
            type="button"
          >
            <LogOut className="size-3.5" />
            Destroy Room
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
