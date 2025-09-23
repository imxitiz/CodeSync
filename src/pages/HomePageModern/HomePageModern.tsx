import { type FormEvent, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { waitForServerHealth, wakeUpServer } from "@/utils/healthCheck";

export default function HomePageModern() {
  const [roomId, setRoomId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [isCheckingServer, setIsCheckingServer] = useState<boolean>(false);
  const [serverStatusMessage, setServerStatusMessage] = useState<string>("");

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const id = location.state?.id || null;
    if (id) {
      setRoomId(id);
    }
    wakeUpServer();
  }, [location.state]);

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
      <section className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-3 py-10 md:grid-cols-2 md:py-16">
        <div className="order-2 md:order-1">
          <h1 className="text-balance bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text font-semibold text-3xl text-transparent tracking-tight sm:text-4xl md:text-5xl">
            Collaborate in real-time.
            <br />
            Share code with one link.
          </h1>
          <p className="mt-3 max-w-prose text-pretty text-muted-foreground text-sm sm:text-base">
            Create a room, share the link, and start collaborating instantly. No
            setup, just productive pairing with live presence and editor
            control. Fully themeable with light, dark, and custom palettes.
          </p>

          <ul className="mt-5 grid gap-2 text-muted-foreground text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              One-click join via link
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              Editor handoff control
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              Accessible, keyboard-friendly
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              Import themes from tweakcn
            </li>
          </ul>
        </div>

        <div className="order-1 md:order-2">
          <Card className="mx-auto w-full max-w-md border border-primary">
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
        </div>
      </section>

      <footer className="pointer-events-none fixed inset-x-0 bottom-3 grid place-items-center px-3">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs shadow-sm backdrop-blur">
          <span className="text-muted-foreground">
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
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground">
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
    </AppShell>
  );
}
