import { Code } from "lucide-react";

type EmptyStateProps = {
  participantCount: number;
  currentEditor?: string;
  isOwner?: boolean;
  canEdit?: boolean;
};

export default function EmptyState({
  participantCount,
  currentEditor,
  isOwner,
  canEdit,
}: EmptyStateProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 animate-fade-in"
    >
      <div className="space-y-3 text-center">
        <Code className="mx-auto size-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {isOwner || canEdit
            ? "Start typing to collaborate..."
            : "Waiting for others..."}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {participantCount} {participantCount === 1 ? "person" : "people"} in
          this room
          {currentEditor && ` · ${currentEditor} is editing`}
        </p>
      </div>
    </div>
  );
}
