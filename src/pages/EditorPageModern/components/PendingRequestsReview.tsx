import {
  ChevronDown,
  ChevronUp,
  Lock,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { EditorTab, TabPermissions } from "../types";

type PendingRequest = {
  tabId: string;
  tabName: string;
  requester: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tabs: EditorTab[];
  tabPermissions: TabPermissions;
  currentUser: string;
  onApprove: (tabId: string, requester: string) => void;
  onDeny: (tabId: string, requester: string) => void;
};

export default function PendingRequestsReview({
  open,
  onClose,
  tabs,
  tabPermissions,
  currentUser,
  onApprove,
  onDeny,
}: Props) {
  const titleId = useId();
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});

  if (!open) return null;

  // Collect all pending requests across all tabs
  const pendingRequests: PendingRequest[] = [];
  for (const tab of tabs) {
    const tabPerms = tabPermissions[tab.id];
    if (!tabPerms) continue;
    for (const [username, level] of Object.entries(tabPerms)) {
      if (level === "REQUESTED" && username !== currentUser) {
        pendingRequests.push({
          tabId: tab.id,
          tabName: tab.name,
          requester: username,
        });
      }
    }
  }

  if (pendingRequests.length === 0) return null;

  // Group by tab for organized display
  const requestsByTab = pendingRequests.reduce<
    Record<string, PendingRequest[]>
  >((acc, req) => {
    if (!acc[req.tabId]) acc[req.tabId] = [];
    acc[req.tabId]?.push(req);
    return acc;
  }, {});

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-background/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg border bg-card p-0 shadow-xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <h2 id={titleId} className="font-semibold text-lg">
            Pending Edit Requests ({pendingRequests.length})
          </h2>
          <button
            aria-label="Close"
            className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {Object.entries(requestsByTab).map(([tabId, requests]) => {
            const tab = tabs.find((t) => t.id === tabId);
            const isExpanded = expandedTabs[tabId] ?? true;
            return (
              <Collapsible
                key={tabId}
                open={isExpanded}
                onOpenChange={(open) =>
                  setExpandedTabs((prev) => ({ ...prev, [tabId]: open }))
                }
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="size-4 text-muted-foreground" />
                      <span className="truncate">
                        {tab?.name ?? "Unknown tab"}
                      </span>
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {requests.length} pending
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2 pb-2">
                  {requests.map((req) => (
                    <div
                      key={`${req.tabId}-${req.requester}`}
                      className="flex items-center justify-between gap-3 rounded-md border bg-muted/50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium text-sm">
                            {req.requester.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">{req.requester}</p>
                          <p className="text-xs text-muted-foreground">
                            Requested edit access
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-success text-success hover:bg-success/10"
                          onClick={() => {
                            onApprove(req.tabId, req.requester);
                          }}
                        >
                          <UserCheck className="size-3.5" />
                          <span>Approve</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            onDeny(req.tabId, req.requester);
                          }}
                        >
                          <UserX className="size-3.5" />
                          <span>Deny</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  );
}
