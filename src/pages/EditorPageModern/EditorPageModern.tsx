import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import Avatar from "react-avatar";
import toast from "react-hot-toast";
import { FaCrown } from "react-icons/fa";
import { FaRegCopy } from "react-icons/fa6";
import { FiEdit2, FiLogOut } from "react-icons/fi";
import { MdTextDecrease, MdTextIncrease } from "react-icons/md";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import ClientModern from "@/components/ClientModern";
import EditorWrapper from "@/components/EditorWrapper";
import { Button } from "@/components/ui/button";
import { ACTIONS } from "@/utils/constants";
import { initSocket } from "@/utils/socket";

type Client = {
  socketId: string;
  username: string;
};

type Socket = {
  // biome-ignore lint/suspicious/noExplicitAny: Socket data can be any shape for real-time events
  emit: (event: string, data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Socket callbacks receive any data structure
  on: (event: string, callback: (data: any) => void) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Socket callbacks receive any data structure
  off: (event: string, callback: (data: any) => void) => void;
  disconnect: () => void;
};

/**
 * EditorPageModern (Top-Bar + Editor canvas)
 * - No page scroll; only internal areas can scroll
 * - Top bar with room info, compact participants (avatars), accessibility tools
 * - Expandable Participants Panel (70% viewport; scrollable if overflow)
 * - Zen Mode (hide top-bar for distraction-free editing)
 * - Copy actions in the toolbar (no floating buttons over the editor)
 * - Line wrap toggle (Editor supports wrapping without horizontal scroll)
 */
export default function EditorPageModern() {
  const [clients, setClients] = useState<Client[]>([]);
  const [currentEditor, setCurrentEditor] = useState<string>("");
  const currentEditorRef = useRef<string>(currentEditor);
  const [roomCreator, setRoomCreator] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const codeRef = useRef<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const userName = location.state?.userName || "User";

  // Track current dark mode based on document root class
  const getIsDark = () => document?.documentElement.classList.contains("dark");
  const [isDark, setIsDark] = useState<boolean>(getIsDark());

  // biome-ignore lint/correctness/useExhaustiveDependencies: First load only
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(getIsDark());
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // UI state
  const [serverStatus, setServerStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");
  const [connectionMessage, setConnectionMessage] = useState<string>(
    "Connecting to server..."
  );
  const [wrapLines, setWrapLines] = useState<boolean>(false);
  const [showParticipants, setShowParticipants] = useState<boolean>(false);
  const [zen, setZen] = useState<boolean>(false);

  // Derived
  const isOwner = userName === roomCreator;

  const sortedClients = useMemo(
    () =>
      [...(clients || [])].sort((a, b) => {
        if (a.username === roomCreator) {
          return -1;
        }
        if (b.username === roomCreator) {
          return 1;
        }
        return 0;
      }),
    [clients, roomCreator]
  );

  const compactAvatars = useMemo(() => {
    const max = 5;
    const slice = sortedClients.slice(0, max);
    const extra = Math.max(0, sortedClients.length - slice.length);
    return { slice, extra };
  }, [sortedClients]);

  // Handlers
  const handleErrors = () => {
    setServerStatus("disconnected");
    setConnectionMessage("Connection lost - Reconnecting...");
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(id || "");
      toast.success("Room Id copied to clipboard");
    } catch {
      toast.error("Failed to copy Room Id");
    }
  };

  const copyCode = async (): Promise<string | undefined> => {
    try {
      if (!codeRef.current) {
        toast.error("No code to copy");
        return;
      }
      await navigator.clipboard.writeText(codeRef.current);
      toast.success("Code copied to clipboard");
      return codeRef.current;
    } catch {
      toast.error("Failed to copy code , please try again");
      return;
    }
  };

  const leaveRoom = () => {
    if (sessionStorage.getItem("admin") === roomCreator) {
      sessionStorage.removeItem("admin");
    }
    navigate("/");
  };

  const fontSizeChange = (change: number) => {
    const root = document.documentElement;
    const currentSize = Number.parseInt(
      getComputedStyle(root).getPropertyValue("--editor-font-size") || "16px",
      10
    );
    const newSize = Math.max(8, Math.min(currentSize + change, 36));
    root.style.setProperty("--editor-font-size", `${newSize}px`);
  };

  const toggleEditable = (): void => {
    if (currentEditor === userName) {
      setCurrentEditor("");
      toast.success("Editor is now read-only");
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
          roomId: id,
          currenteditor: "",
        });
      }
    } else {
      if (!isOwner) {
        toast.error("Only the room creator can change the editable state");
        return;
      }
      setCurrentEditor(userName);
      toast.success("Editor is now editable");
      if (socketRef.current) {
        socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
          roomId: id,
          currenteditor: userName,
        });
      }
    }
  };

  const handleGrantEditor = (username: string) => {
    setCurrentEditor(username);
    toast.success(`${username} can now edit the code`);
    if (socketRef.current) {
      socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: username,
      });
    }
  };

  // Keep ref in sync
  useEffect(() => {
    currentEditorRef.current = currentEditor;
  }, [currentEditor]);

  // Socket init and events
  // biome-ignore lint/correctness/useExhaustiveDependencies: First load only
  useEffect(() => {
    document.title = `${id} - CodeSync`;

    const init = async () => {
      try {
        setServerStatus("connecting");
        setConnectionMessage("Connecting to server...");

        socketRef.current = await initSocket();

        if (socketRef.current) {
          socketRef.current.on("connect", () => {
            setServerStatus("connected");
            setConnectionMessage("Connected!");
          });

          socketRef.current.on("connect_error", handleErrors);
          socketRef.current.on("connect_failed", handleErrors);
          socketRef.current.on("disconnect", () => {
            setServerStatus("disconnected");
            setConnectionMessage("Connection lost - Reconnecting...");
          });

          socketRef.current.emit(ACTIONS.JOIN, {
            roomId: id,
            userName,
          });

          socketRef.current.on(
            ACTIONS.JOINED,
            ({
              clients: joinedClients,
              username,
              socketId,
              roomcreator,
            }: {
              clients: Client[];
              username: string;
              socketId: string;
              roomcreator: string;
            }) => {
              setClients(joinedClients);
              setRoomCreator(roomcreator);
              if (
                username === userName &&
                roomcreator === username &&
                sessionStorage.getItem("admin") !== roomcreator &&
                joinedClients.length !== 1
              ) {
                toast.error(
                  `${username} is already in the ${id} room.\nPlease try another UserName!`
                );
                navigate("/", {
                  state: { id },
                });
              }
              if (roomCreator === username || joinedClients.length === 1) {
                sessionStorage.setItem("admin", username);
              }
              if (username !== userName) {
                toast.success(`${username} joined the room`);
                if (codeRef.current && socketRef.current) {
                  socketRef.current.emit(ACTIONS.SYNC_CODE, {
                    socketId,
                    code: codeRef.current,
                    currenteditor: currentEditorRef.current,
                  });
                }
              }
            }
          );

          socketRef.current.on(
            ACTIONS.DUPLICATE_USER,
            ({ username }: { username: string }) => {
              toast.error(
                `${username} is already in the ${id} room.\nPlease try another UserName!`
              );
              navigate("/", {
                state: { id },
              });
            }
          );

          socketRef.current.on(
            ACTIONS.DISCONNECTED,
            ({
              socketId,
              username,
            }: {
              socketId: string;
              username: string;
            }) => {
              toast.success(`${username} left the room`);
              setClients((prev) =>
                prev.filter((client) => client.socketId !== socketId)
              );
              if (currentEditor === username) {
                setCurrentEditor("");
                if (socketRef.current) {
                  socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
                    roomId: id,
                    currenteditor: "",
                  });
                }
              }
            }
          );

          socketRef.current.on(
            ACTIONS.SET_CURRENT_EDITOR,
            ({ currenteditor }: { currenteditor: string }) => {
              if (currenteditor === userName) {
                toast.success("You are now the editor");
              }
              if (currenteditor === "" && userName === roomCreator) {
                toast.success(
                  `${currentEditorRef.current} have released control`
                );
              }
              setCurrentEditor(currenteditor);
            }
          );
        }
      } catch (_error) {
        setServerStatus("disconnected");
        setConnectionMessage("Failed to connect to server");
        toast.error(
          "Failed to connect to server. Please check your connection."
        );
        setTimeout(() => {
          navigate("/");
        }, 3000);
      }
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect if no state
  useEffect(() => {
    if (!location.state) {
      if (id) {
        navigate("/", {
          state: { id },
        });
      } else {
        navigate("/");
      }
    }
  }, [location.state, id, navigate]);

  // UI
  return (
    <AppShell className="relative">
      {/* Prevent page-level scroll; only internal regions may scroll */}
      <div className="h-full w-full overflow-hidden bg-background">
        {/* CodeMirror scroller rules */}
        <style>{`
          /* Host container fills the available area */
          .editor-host {
            position: absolute;
            inset: 0;
            height: 100%;
            width: 100%;
            min-height: 0;
            min-width: 0;
          }
          /* CodeMirror root must occupy full size */
          .editor-host .cm-editor {
            height: 100% !important;
            width: 100% !important;
            min-height: 0 !important;
            min-width: 0 !important;
            font-size: var(--editor-font-size, 16px);
            line-height: 1.6;
            background: var(--card);
            /* do NOT set overflow here; scroller handles it */
          }
          /* Primary scroll container (both axes) */
          .editor-host .cm-scroller {
            height: 100% !important;
            width: 100% !important;
            min-height: 0 !important;
            min-width: 0 !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            scrollbar-gutter: stable both-edges;
          }
          /* Ensure gutters/content fill and scroll properly */
          .editor-host .cm-gutters {
            height: 100% !important;
          }
          .editor-host .cm-content {
            box-sizing: border-box !important;
          }
          /* Horizontal scroll when wrapping is disabled */
          .editor-host.no-wrap .cm-content {
            min-width: max-content;
            white-space: pre;
          }
          /* Wrap long lines when enabled */
          .editor-host.wrap-on .cm-content {
            min-width: 0;
            white-space: pre-wrap;
            word-break: break-word;
          }
        `}</style>

        {/* Column layout: top-bar + editor canvas */}
        <div className="flex h-full flex-col overflow-hidden">
          {/* Top bar (hidden in Zen) */}
          {!zen && (
            <div className="sticky top-0 z-35 flex items-center justify-between gap-2 overflow-x-scroll border-b bg-background/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
              {/* Left: room info */}
              <div className="min-w-0">
                <p className="truncate font-semibold text-sm">
                  Room:
                  <span className="ms-2 inline-flex items-center rounded-md border bg-secondary px-2 py-0.5 font-medium text-secondary-foreground text-xs">
                    {id}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-muted-foreground text-xs">
                  Welcome,
                  <span className="ms-1 inline-flex items-center rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground">
                    {userName}
                  </span>
                  {serverStatus !== "connected" ? (
                    <span
                      aria-live="polite"
                      className="ms-2 inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200"
                    >
                      {connectionMessage}
                    </span>
                  ) : null}
                </p>
              </div>

              {/* Middle: compact participants */}
              <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 sm:flex">
                <div className="flex items-center gap-1">
                  {compactAvatars.slice.map(({ socketId, username }) => {
                    const crown = username === roomCreator;
                    const pencil = username === currentEditor;
                    return (
                      <div className="relative" key={socketId}>
                        <Avatar
                          fgColor="#000"
                          name={username}
                          round="8px"
                          size="32"
                        />
                        {crown ? (
                          <span
                            className="-right-1.5 -top-1.5 pointer-events-none absolute inline-flex size-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm ring-1 ring-border"
                            title="Owner"
                          >
                            <FaCrown className="size-3.5" />
                          </span>
                        ) : null}
                        {pencil ? (
                          <span
                            className="-left-1.5 -bottom-1.5 pointer-events-none absolute inline-flex size-5 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 shadow-sm ring-1 ring-border"
                            title="Editor"
                          >
                            <FiEdit2 className="size-3.5" />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {compactAvatars.extra > 0 && (
                    <button
                      aria-label="Show all participants"
                      className="ms-1 cursor-pointer rounded-md border bg-background px-2 py-1 text-foreground text-xs hover:bg-accent"
                      onClick={() => setShowParticipants(true)}
                      title="Show all participants"
                      type="button"
                    >
                      +{compactAvatars.extra}
                    </button>
                  )}
                </div>
              </div>

              {/* Right: tools */}
              <div className="flex items-center gap-1">
                <Button
                  onClick={() => fontSizeChange(2)}
                  size="sm"
                  title="Increase editor text size"
                  variant="outline"
                >
                  <MdTextIncrease />
                </Button>
                <Button
                  onClick={() => fontSizeChange(-2)}
                  size="sm"
                  title="Decrease editor text size"
                  variant="outline"
                >
                  <MdTextDecrease />
                </Button>

                <Button
                  onClick={() => setWrapLines((v) => !v)}
                  size="sm"
                  title="Toggle line wrap"
                  variant={wrapLines ? "secondary" : "outline"}
                >
                  {wrapLines ? "Wrap: On" : "Wrap: Off"}
                </Button>

                <Button
                  onClick={copyCode}
                  size="sm"
                  title="Copy code"
                  variant="outline"
                >
                  <FaRegCopy />{" "}
                  <span className="hidden sm:inline-block">Copy</span>
                </Button>

                <Button
                  onClick={copyRoomId}
                  size="sm"
                  title="Copy room id"
                  variant="outline"
                >
                  ID
                </Button>

                {(currentEditor === userName ||
                  (isOwner && currentEditor !== "")) && (
                  <Button
                    onClick={toggleEditable}
                    size="sm"
                    title={
                      currentEditor === userName
                        ? "Release Control"
                        : "Take Control"
                    }
                    variant={
                      currentEditor === userName ? "secondary" : "default"
                    }
                  >
                    {currentEditor === userName ? "Release" : "Take"}
                  </Button>
                )}

                <Button
                  className="hidden sm:inline-flex"
                  onClick={() => setShowParticipants(true)}
                  size="sm"
                  title="Toggle participants"
                  variant="ghost"
                >
                  People
                </Button>

                <Button
                  onClick={() => setZen((v) => !v)}
                  size="sm"
                  title={zen ? "Exit Zen mode" : "Enter Zen mode"}
                  variant={zen ? "secondary" : "outline"}
                >
                  {zen ? "Exit Zen" : "Zen"}
                </Button>

                <Button
                  onClick={leaveRoom}
                  size="sm"
                  title="Leave room"
                  variant="destructive"
                >
                  <FiLogOut />{" "}
                  <span className="hidden sm:inline-block">Leave</span>
                </Button>
              </div>
            </div>
          )}

          {/* Editor canvas (fills remaining height) */}
          <section className="relative min-h-0 flex-1 overflow-hidden">
            {/* Exit Zen small control */}
            {zen && (
              <button
                aria-label="Exit Zen mode"
                className="absolute top-3 right-3 z-20 inline-flex cursor-pointer items-center justify-center rounded-md border bg-background/90 px-2 py-1 text-xs shadow-sm outline-none backdrop-blur focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={() => setZen(false)}
                title="Exit Zen mode"
                type="button"
              >
                Exit Zen
              </button>
            )}

            {/* Participants Panel (overlay) */}
            {showParticipants && (
              <div
                aria-labelledby="participants-title"
                aria-modal="true"
                className="absolute inset-0 z-50 grid place-items-center p-3"
                role="dialog"
              >
                <div
                  className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                  onClick={() => setShowParticipants(false)}
                />
                <div className="relative z-10 w-full max-w-4xl rounded-lg border bg-card text-card-foreground shadow-lg">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2
                      className="font-semibold text-sm"
                      id="participants-title"
                    >
                      Participants ({sortedClients.length})
                    </h2>
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <span className="text-muted-foreground text-xs">
                          Tip: Click a user to grant editor
                        </span>
                      )}
                      <Button
                        onClick={() => setShowParticipants(false)}
                        size="sm"
                        variant="ghost"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[70svh] overflow-y-auto px-4 py-3">
                    <div className="space-y-2">
                      {sortedClients.map(({ socketId, username }) => (
                        <div
                          className={isOwner ? "cursor-pointer" : ""}
                          key={socketId}
                          onClick={
                            isOwner
                              ? () => handleGrantEditor(username)
                              : undefined
                          }
                          title={isOwner ? "Click to grant editor" : undefined}
                        >
                          <ClientModern
                            canGrantEdit={isOwner}
                            currentEditor={currentEditor}
                            roomcreator={roomCreator}
                            username={username}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                    <Button onClick={copyRoomId} size="sm" variant="outline">
                      Copy Room Id
                    </Button>
                    <Button
                      onClick={() => setShowParticipants(false)}
                      size="sm"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Editor wrapper takes full available space */}
            <div
              className={`editor-host h-full w-full ${
                wrapLines ? "wrap-on" : "no-wrap"
              }`}
            >
              <EditorWrapper
                currentEditor={currentEditor}
                darkMode={isDark}
                editable={userName === currentEditor || isOwner}
                onCodeChange={(code: string) => {
                  codeRef.current = code;
                }}
                roomId={id || ""}
                setCurrentEditor={setCurrentEditor}
                socketRef={socketRef as RefObject<Socket>}
                wrap={wrapLines}
              />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
