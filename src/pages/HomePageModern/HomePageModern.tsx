import { type FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
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
import {
  BACKEND_API_URL,
  clearCustomBackendUrl,
  getBackendUrl,
  hasCustomBackendUrl,
  isValidBackendUrl,
  setCustomBackendUrl,
} from "@/utils/constants";
import { waitForServerHealth, wakeUpServer } from "@/utils/healthCheck";

export default function HomePageModern() {
  const [roomId, setRoomId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [isCheckingServer, setIsCheckingServer] = useState<boolean>(false);
  const [serverStatusMessage, setServerStatusMessage] = useState<string>("");
  const [isCustomBackend, setIsCustomBackend] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [customBackendInput, setCustomBackendInput] = useState<string>("");

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const id = location.state?.id || null;
    if (id) {
      setRoomId(id);
    }
    wakeUpServer();
  }, [location.state]);

  useEffect(() => {
    const hasCustom = hasCustomBackendUrl();
    if (hasCustom) {
      setIsCustomBackend(true);
      setShowAdvanced(true);
      setCustomBackendInput(getBackendUrl());
    }
  }, []);

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

  const saveCustomBackend = () => {
    const trimmed = customBackendInput.trim();
    if (!trimmed) {
      toast.error("Please enter a backend URL");
      return;
    }
    if (!isValidBackendUrl(trimmed)) {
      toast.error("Use a valid http(s) origin without a path");
      return;
    }
    setCustomBackendUrl(trimmed);
    setCustomBackendInput(getBackendUrl());
    setIsCustomBackend(true);
    toast.success("Custom backend URL saved");
    wakeUpServer();
  };

  const resetBackendUrl = () => {
    clearCustomBackendUrl();
    setCustomBackendInput("");
    setIsCustomBackend(false);
    toast.success("Reset to default backend");
    wakeUpServer();
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
            <h1 className="text-balance font-semibold text-foreground text-2xl tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
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

                <div className="space-y-2 border-t pt-3">
                  <button
                    className="flex w-full cursor-pointer items-center gap-1 font-medium text-muted-foreground text-xs hover:text-foreground"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    type="button"
                  >
                    <span
                      className={`inline-block transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                    >
                      ▶
                    </span>
                    Advanced Settings
                    {isCustomBackend && (
                      <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[10px]">
                        custom
                      </span>
                    )}
                  </button>
                  {showAdvanced && (
                    <div className="space-y-2">
                      <label
                        className="font-medium text-muted-foreground text-xs"
                        htmlFor="custom-backend"
                      >
                        Backend URL
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Custom backend URL"
                          className="flex-1 text-xs"
                          id="custom-backend"
                          onChange={(e) =>
                            setCustomBackendInput(e.target.value)
                          }
                          placeholder={BACKEND_API_URL}
                          spellCheck="false"
                          value={customBackendInput}
                        />
                        <Button
                          className="cursor-pointer"
                          disabled={!customBackendInput.trim()}
                          onClick={saveCustomBackend}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Save
                        </Button>
                      </div>
                      {isCustomBackend && (
                        <div className="flex items-center justify-between">
                          <p className="truncate text-[11px] text-muted-foreground">
                            Using: {getBackendUrl()}
                          </p>
                          <Button
                            className="cursor-pointer"
                            onClick={resetBackendUrl}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Reset
                          </Button>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Use the server origin (no path). Requests go to /api and
                        Socket.IO on this origin, which must allow CORS.
                      </p>
                    </div>
                  )}
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
