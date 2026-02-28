import { type FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiClock, FiTrash2, FiX } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { waitForServerHealth, wakeUpServer } from "@/utils/healthCheck";
import {
  clearRoomHistory,
  getRecentRooms,
  type RecentRoom,
  removeRoom,
} from "@/utils/roomHistory";

export default function HomePageModern() {
  const [roomId, setRoomId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [isCheckingServer, setIsCheckingServer] = useState<boolean>(false);
  const [serverStatusMessage, setServerStatusMessage] = useState<string>("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const id = location.state?.id || null;
    if (id) {
      setRoomId(id);
    }
    wakeUpServer();
    setRecentRooms(getRecentRooms());
  }, [location.state]);

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) {
      return "just now";
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const handleSelectRecentRoom = (room: RecentRoom) => {
    setRoomId(room.roomId);
    setUserName(room.userName);
  };

  const handleRemoveRecentRoom = (targetRoomId: string) => {
    removeRoom(targetRoomId);
    setRecentRooms(getRecentRooms());
  };

  const handleClearHistory = () => {
    clearRoomHistory();
    setRecentRooms([]);
    toast.success("Room history cleared");
  };

  const handleHealthCheck = (attempt: number, maxRetries: number) => {
    setServerStatusMessage(`Waking up server... (${attempt}/${maxRetries})`);
  };

  const createnewroom = (e?: FormEvent) => {
    e?.preventDefault?.();
    const id = uuidv4();
    setRoomId(id);
    toast.success("New room created");
  };

  const randomizeName = () => {
    const n = `User${Math.floor(Math.random() * 1000)}`;
    setUserName(n);
  };

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value.length <= 256) {
      setRoomId(e.target.value);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRoomId(text.trim());
        toast.success("Pasted Room ID");
      } else {
        toast("Clipboard is empty");
      }
    } catch {
      toast.error("Clipboard access denied");
    }
  };

  const joinRoom = async (e?: FormEvent) => {
    e?.preventDefault?.();
    if (!roomId.trim()) {
      toast.error("Room id is required");
      return;
    }

    let finalUserName = userName.trim();
    if (!finalUserName) {
      finalUserName = `User${Math.floor(Math.random() * 1000)}`;
      setUserName(finalUserName);
    }

    setIsCheckingServer(true);
    setServerStatusMessage("Checking server connection...");

    try {
      const isServerHealthy = await waitForServerHealth({
        maxRetries: 5,
        retryDelay: 2000,
        timeout: 8000,
        onRetry: handleHealthCheck,
      });

      if (isServerHealthy) {
        setServerStatusMessage("Server connected! Joining room...");
        navigate(`/editor/${roomId}`, {
          state: {
            userName: finalUserName,
            serverHealthy: true,
          },
        });
      } else {
        setServerStatusMessage("");
        toast.error("Server is not responding. Please try again later.");
      }
    } catch {
      setServerStatusMessage("");
      toast.error("Failed to connect to server. Please try again.");
    } finally {
      setIsCheckingServer(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      joinRoom(e);
    }
  };

  return (
    <AppShell className="relative">
      <div className="flex min-h-full flex-col">
        <section className="mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 content-center items-center gap-6 px-4 py-8 md:grid-cols-2 md:gap-12 md:py-0">
          <div>
            <h1 className="text-balance font-semibold text-2xl text-foreground tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
              Collaborate in real-time.
              <br />
              Share code with one link.
            </h1>
            <p className="mt-3 max-w-prose text-pretty text-muted-foreground text-sm leading-relaxed sm:text-base">
              Create a room, share the link, and start collaborating instantly.
              No setup, just productive pairing with live presence and editor
              control.
            </p>

            <ul className="mt-5 grid gap-2 text-muted-foreground text-sm sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-foreground/40" />
                One-click join via link
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-foreground/40" />
                Editor handoff control
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-foreground/40" />
                Accessible, keyboard-friendly
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-foreground/40" />
                Import themes from tweakcn
              </li>
            </ul>
          </div>

          <div>
            <Card className="mx-auto w-full max-w-md border">
              <CardHeader>
                <CardTitle>Join a room</CardTitle>
                <CardDescription>
                  Paste an invite ID or create a new room to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {serverStatusMessage && (
                  <div className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm">
                    {serverStatusMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor="room-id">
                    Room ID
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-describedby="room-help"
                      aria-label="Room ID"
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      autoFocus
                      className="flex-1 cursor-text"
                      id="room-id"
                      inputMode="text"
                      maxLength={256}
                      onChange={handleRoomIdChange}
                      onKeyDown={onKeyDown}
                      placeholder="Enter or paste room id"
                      spellCheck="false"
                      value={roomId}
                    />
                    <Button
                      className="cursor-pointer"
                      onClick={pasteFromClipboard}
                      size="sm"
                      tabIndex={-1}
                      title="Paste from clipboard"
                      type="button"
                      variant="outline"
                    >
                      Paste
                    </Button>
                  </div>
                  <p className="sr-only" id="room-help">
                    Tip: Press Ctrl/⌘+V to paste quickly.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="font-medium text-sm" htmlFor="username">
                    Your name
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Your name"
                      className="flex-1"
                      id="username"
                      maxLength={32}
                      onChange={(e) => setUserName(e.target.value)}
                      onKeyDown={onKeyDown}
                      placeholder="e.g. Alex"
                      spellCheck="false"
                      value={userName}
                    />
                    <Button
                      onClick={randomizeName}
                      size="sm"
                      title="Generate a random name"
                      type="button"
                      variant="ghost"
                    >
                      Random
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch gap-2">
                <Button
                  aria-label="Join room"
                  className="w-full"
                  disabled={isCheckingServer}
                  onClick={joinRoom}
                  size="lg"
                >
                  {isCheckingServer ? "Connecting..." : "Join now"}
                </Button>
                <div className="flex items-center justify-center">
                  <Button
                    onClick={createnewroom}
                    size="sm"
                    title="Generate a new room ID"
                    type="button"
                    variant="ghost"
                  >
                    Create new room
                  </Button>
                </div>
              </CardFooter>
            </Card>

            {/* Recent Rooms — stored locally on this device only */}
            {recentRooms.length > 0 && (
              <div className="mx-auto mt-4 w-full max-w-md">
                <div className="flex items-center justify-between px-1">
                  <h3 className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
                    <FiClock className="size-3" />
                    Recent rooms
                    <span className="text-muted-foreground/60">
                      (this device only)
                    </span>
                  </h3>
                  <Button
                    className="cursor-pointer"
                    onClick={handleClearHistory}
                    size="sm"
                    title="Clear room history"
                    type="button"
                    variant="ghost"
                  >
                    <FiTrash2 className="size-3" />
                    <span className="sr-only sm:not-sr-only">Clear</span>
                  </Button>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {recentRooms.map((room) => (
                    <li key={room.roomId}>
                      <div
                        className="flex w-full cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => handleSelectRecentRoom(room)}
                        title="Click to fill room details"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-xs">
                            {room.roomId.length > 20
                              ? `${room.roomId.slice(0, 8)}…${room.roomId.slice(-8)}`
                              : room.roomId}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            as {room.userName} · {formatTimeAgo(room.joinedAt)}
                          </span>
                        </div>
                        <button
                          aria-label={`Remove ${room.roomId} from history`}
                          className="shrink-0 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecentRoom(room.roomId);
                          }}
                          type="button"
                        >
                          <FiX className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <footer className="shrink-0 py-4 text-center">
          <div className="inline-flex items-center gap-2 text-muted-foreground text-xs">
            <span>
              Built with ❤️ by{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://github.com/sachinthapa572"
                rel="noreferrer"
                target="_blank"
              >
                Sachin Thapa
              </a>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Maintainers:{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://github.com/imxitiz"
                rel="noreferrer"
                target="_blank"
              >
                Kshitiz
              </a>
            </span>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
