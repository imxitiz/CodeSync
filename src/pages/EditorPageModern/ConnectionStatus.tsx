import { useEffect, useState } from "react";
import { getBackendUrl } from "@/utils/constants";

type ConnectionStatusProps = {
  status: "connecting" | "connected" | "disconnected";
};

export default function ConnectionStatus({ status }: ConnectionStatusProps) {
  const serverUrl = getBackendUrl();

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "disconnected") {
      setCountdown(null);
      return;
    }
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return 3;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === "connected") {
    return (
      <span
        aria-live="polite"
        className="group relative flex items-center"
        title="Connected"
      >
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
        <span
          className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-card border px-2 py-1 text-xs text-muted-foreground shadow-sm group-hover:block"
          role="tooltip"
        >
          Connected to {serverUrl}
        </span>
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span
        aria-live="polite"
        className="group relative flex items-center gap-1"
        title="Connecting"
      >
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-muted opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-muted" />
        </span>
        <span className="hidden text-muted-foreground text-xs sm:inline">
          Connecting...
        </span>
        <span
          className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-card border px-2 py-1 text-xs text-muted-foreground shadow-sm group-hover:block"
          role="tooltip"
        >
          Establishing WebSocket connection to {serverUrl}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-live="polite"
      className="group relative flex items-center gap-1"
      title="Disconnected"
    >
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-destructive" />
      </span>
      <span className="hidden text-destructive dark:text-destructive text-xs sm:inline">
        {countdown !== null
          ? `Reconnecting in ${countdown}s...`
          : "Reconnecting..."}
      </span>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-card border px-2 py-1 text-xs text-muted-foreground shadow-sm group-hover:block"
        role="tooltip"
      >
        Connection lost. Attempting to reconnect to {serverUrl}...
      </span>
    </span>
  );
}
