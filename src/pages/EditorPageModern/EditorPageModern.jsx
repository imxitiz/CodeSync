import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell.jsx";
import ClientModern from "@/components/ClientModern.jsx";
import EditorWrapper from "@/components/EditorWrapper.jsx";
import { initSocket } from "@/utils/socket";
import { ACTIONS } from "@/utils/constant";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { MdTextDecrease, MdTextIncrease } from "react-icons/md";
import { FiLogOut, FiEdit2 } from "react-icons/fi";
import { FaRegCopy } from "react-icons/fa6";
import { FaCrown } from "react-icons/fa";
import { Button } from "@/components/ui/button.jsx";
import Avatar from "react-avatar";

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
  const [clients, setClients] = useState([]);
  const [currentEditor, setCurrentEditor] = useState("");
  const currentEditorRef = useRef(currentEditor);
  const [roomCreator, setRoomCreator] = useState(null);
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const userName = location.state?.userName || "User";

  // Track current dark mode based on document root class
  const getIsDark = () =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const [isDark, setIsDark] = useState(getIsDark());

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(getIsDark());
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // UI state
  const [serverStatus, setServerStatus] = useState("connecting"); // 'connecting', 'connected', 'disconnected'
  const [connectionMessage, setConnectionMessage] = useState("Connecting to server...");
  const [wrapLines, setWrapLines] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [zen, setZen] = useState(false);

  // Derived
  const isOwner = userName === roomCreator;

  const sortedClients = useMemo(() => {
    return [...(clients || [])].sort((a, b) =>
      a.username === roomCreator ? -1 : b.username === roomCreator ? 1 : 0
    );
  }, [clients, roomCreator]);

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
      await navigator.clipboard.writeText(id);
      toast.success("Room Id copied to clipboard");
    } catch {
      toast.error("Failed to copy Room Id");
    }
  };

  const copyCode = async () => {
    try {
      if (!codeRef.current) return toast.error("No code to copy");
      await navigator.clipboard.writeText(codeRef.current);
      toast.success("Code copied to clipboard");
    } catch {
      toast.error("Failed to copy code , please try again");
    }
  };

  const leaveRoom = () => {
    if (sessionStorage.getItem("admin") === roomCreator) {
      sessionStorage.removeItem("admin");
    }
    navigate("/");
  };

  const fontSizeChange = (change) => {
    const root = document.documentElement;
    const currentSize = parseInt(
      getComputedStyle(root).getPropertyValue("--editor-font-size") || 16
    );
    const newSize = Math.max(8, Math.min(currentSize + change, 36));
    root.style.setProperty("--editor-font-size", `${newSize}px`);
  };

  const toggleEditable = () => {
    if (currentEditor === userName) {
      setCurrentEditor("");
      toast.success("Editor is now read-only");
      socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: "",
      });
    } else {
      if (!isOwner) return toast.error("Only the room creator can change the editable state");
      setCurrentEditor(userName);
      toast.success("Editor is now editable");
      socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: userName,
      });
    }
  };

  const handleGrantEditor = (username) => {
    setCurrentEditor(username);
    toast.success(`${username} can now edit the code`);
    socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
      roomId: id,
      currenteditor: username,
    });
  };

  // Keep ref in sync
  useEffect(() => {
    currentEditorRef.current = currentEditor;
  }, [currentEditor]);

  // Socket init and events
  useEffect(() => {
    document.title = `${id} - CodeSync`;

    const init = async () => {
      try {
        setServerStatus("connecting");
        setConnectionMessage("Connecting to server...");

        socketRef.current = await initSocket();

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
          ({ clients, username, socketId, roomcreator }) => {
            setClients(clients);
            setRoomCreator(roomcreator);
            if (username === userName && roomcreator === username) {
              if (
                sessionStorage.getItem("admin") !== roomcreator &&
                clients.length !== 1
              ) {
                toast.error(
                  `${username} is already in the ${id} room.\nPlease try another UserName!`
                );
                navigate(`/`, {
                  state: { id },
                });
              }
            }
            if (roomCreator === username || clients.length === 1) {
              sessionStorage.setItem("admin", username);
            }
            if (username !== userName) {
              toast.success(`${username} joined the room`);
              if (codeRef.current) {
                socketRef.current.emit(ACTIONS.SYNC_CODE, {
                  socketId,
                  code: codeRef.current,
                  currenteditor: currentEditorRef.current,
                });
              }
            }
          }
        );

        socketRef.current.on(ACTIONS.DUPLICATE_USER, ({ username }) => {
          toast.error(
            `${username} is already in the ${id} room.\nPlease try another UserName!`
          );
          navigate(`/`, {
            state: { id },
          });
        });

        socketRef.current.on(
          ACTIONS.DISCONNECTED,
          ({ socketId, username }) => {
            toast.success(`${username} left the room`);
            setClients((prev) =>
              prev.filter((client) => client.socketId !== socketId)
            );
            if (currentEditor === username) {
              setCurrentEditor("");
              socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
                roomId: id,
                currenteditor: "",
              });
            }
          }
        );

        socketRef.current.on(
          ACTIONS.SET_CURRENT_EDITOR,
          ({ currenteditor }) => {
            if (currenteditor === userName) {
              toast.success("You are now the editor");
            }
            if (currenteditor === "" && userName === roomCreator) {
              toast.success(`${currentEditorRef.current} have released control`);
            }
            setCurrentEditor(currenteditor);
            return () => {
              socketRef.current.off(ACTIONS.SET_CURRENT_EDITOR);
            };
          }
        );
      } catch (error) {
        setServerStatus("disconnected");
        setConnectionMessage("Failed to connect to server");
        toast.error("Failed to connect to server. Please check your connection.");
        setTimeout(() => {
          navigate("/");
        }, 3000);
      }
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.SET_CURRENT_EDITOR);
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect if no state
  useEffect(() => {
    if (!location.state) {
      if (id) {
        navigate(`/`, {
          state: { id },
        });
      } else {
        navigate(`/`);
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
            <div className="sticky top-0 z-35 flex items-center justify-between gap-2 border-b bg-background/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 overflow-x-scroll">
              {/* Left: room info */}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  Room:
                  <span className="ms-2 inline-flex items-center rounded-md border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    {id}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  Welcome,
                  <span className="ms-1 inline-flex items-center rounded-md bg-accent px-1.5 py-0.5 text-[11px] text-accent-foreground">
                    {userName}
                  </span>
                  {serverStatus !== "connected" ? (
                    <span className="ms-2 inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-200 border border-amber-500/40"
                      aria-live="polite">
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
                      <div key={socketId} className="relative">
                        <Avatar
                          name={username}
                          size={32}
                          round="8px"
                          fgColor="#000"
                        />
                        {crown ? (
                          <span
                            title="Owner"
                            aria-label="Owner"
                            className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-1 ring-border shadow-sm"
                          >
                            <FaCrown className="size-3.5" />
                          </span>
                        ) : null}
                        {pencil ? (
                          <span
                            title="Editor"
                            aria-label="Editor"
                            className="pointer-events-none absolute -left-1.5 -bottom-1.5 inline-flex size-5 items-center justify-center rounded-full bg-emerald-400 text-emerald-950 ring-1 ring-border shadow-sm"
                          >
                            <FiEdit2 className="size-3.5" />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {compactAvatars.extra > 0 && (
                    <button
                      type="button"
                      className="ms-1 rounded-md border bg-background px-2 py-1 text-xs text-foreground hover:bg-accent cursor-pointer"
                      onClick={() => setShowParticipants(true)}
                      aria-label="Show all participants"
                      title="Show all participants"
                    >
                      +{compactAvatars.extra}
                    </button>
                  )}
                </div>
              </div>

              {/* Right: tools */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  title="Increase editor text size"
                  onClick={() => fontSizeChange(2)}
                >
                  <MdTextIncrease />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  title="Decrease editor text size"
                  onClick={() => fontSizeChange(-2)}
                >
                  <MdTextDecrease />
                </Button>

                <Button
                  size="sm"
                  variant={wrapLines ? "secondary" : "outline"}
                  title="Toggle line wrap"
                  onClick={() => setWrapLines((v) => !v)}
                >
                  {wrapLines ? "Wrap: On" : "Wrap: Off"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyCode}
                  title="Copy code"
                >
                  <FaRegCopy /> <span className="hidden sm:inline-block">Copy</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyRoomId}
                  title="Copy room id"
                >
                  ID
                </Button>

                {((currentEditor === userName) || (isOwner && currentEditor !== "")) && (
                  <Button
                    size="sm"
                    variant={currentEditor === userName ? "secondary" : "default"}
                    onClick={toggleEditable}
                    title={
                      currentEditor === userName
                        ? "Release Control"
                        : "Take Control"
                    }
                  >
                    {currentEditor === userName ? "Release" : "Take"}
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  title="Toggle participants"
                  onClick={() => setShowParticipants(true)}
                  className="hidden sm:inline-flex"
                >
                  People
                </Button>

                <Button
                  size="sm"
                  variant={zen ? "secondary" : "outline"}
                  title={zen ? "Exit Zen mode" : "Enter Zen mode"}
                  onClick={() => setZen((v) => !v)}
                >
                  {zen ? "Exit Zen" : "Zen"}
                </Button>

                <Button size="sm" variant="destructive" onClick={leaveRoom} title="Leave room">
                  <FiLogOut /> <span className="hidden sm:inline-block">Leave</span>
                </Button>
              </div>
            </div>
          )}

          {/* Editor canvas (fills remaining height) */}
          <section className="relative flex-1 min-h-0 overflow-hidden">
            {/* Exit Zen small control */}
            {zen && (
              <button
                type="button"
                onClick={() => setZen(false)}
                className="absolute right-3 top-3 z-20 inline-flex items-center justify-center rounded-md border bg-background/90 px-2 py-1 text-xs shadow-sm backdrop-blur outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer"
                aria-label="Exit Zen mode"
                title="Exit Zen mode"
              >
                Exit Zen
              </button>
            )}

            {/* Participants Panel (overlay) */}
            {showParticipants && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="participants-title"
                className="absolute inset-0 z-50 grid place-items-center p-3"
              >
                <div
                  className="absolute inset-0 bg-background/70 backdrop-blur-sm"
                  onClick={() => setShowParticipants(false)}
                />
                <div className="relative z-10 w-full max-w-4xl rounded-lg border bg-card text-card-foreground shadow-lg">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 id="participants-title" className="text-sm font-semibold">
                      Participants ({sortedClients.length})
                    </h2>
                    <div className="flex items-center gap-2">
                      {isOwner && (
                        <span className="text-xs text-muted-foreground">
                          Tip: Click a user to grant editor
                        </span>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setShowParticipants(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[70svh] overflow-y-auto px-4 py-3">
                    <div className="space-y-2">
                      {sortedClients.map(({ socketId, username }) => (
                        <div
                          key={socketId}
                          onClick={
                            isOwner ? () => handleGrantEditor(username) : undefined
                          }
                          className={isOwner ? "cursor-pointer" : ""}
                          title={
                            isOwner ? "Click to grant editor" : undefined
                          }
                        >
                          <ClientModern
                            username={username}
                            roomcreator={roomCreator}
                            currentEditor={currentEditor}
                            canGrantEdit={isOwner}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
                    <Button size="sm" variant="outline" onClick={copyRoomId}>
                      Copy Room Id
                    </Button>
                    <Button size="sm" onClick={() => setShowParticipants(false)}>
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Editor wrapper takes full available space */}
            <div className={`editor-host h-full w-full ${wrapLines ? 'wrap-on' : 'no-wrap'}`}>
              <EditorWrapper
                socketRef={socketRef}
                roomId={id}
                onCodeChange={(code) => {
                  codeRef.current = code;
                }}
                copyCode={copyCode}
                editable={userName === currentEditor || isOwner}
                currentEditor={currentEditor}
                setCurrentEditor={setCurrentEditor}
                wrap={wrapLines}
                darkMode={isDark}
              />
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}