import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

type ShortcutRow = {
  action: string;
  keys: string[];
};

type ShortcutSection = {
  title: string;
  shortcuts: ShortcutRow[];
};

const SECTIONS: ShortcutSection[] = [
  {
    title: "General",
    shortcuts: [
      { action: "Copy code", keys: ["⌘/Ctrl", "C"] },
      { action: "Toggle edit control", keys: ["⌘/Ctrl", "Enter"] },
      { action: "Show shortcuts", keys: ["?"] },
      { action: "Exit zen mode", keys: ["Esc"] },
    ],
  },
  {
    title: "Editor",
    shortcuts: [
      { action: "Save (future)", keys: ["⌘/Ctrl", "S"] },
      { action: "Duplicate line", keys: ["⌘/Ctrl", "D"] },
      { action: "Increase font size", keys: ["⌘/Ctrl", "+"] },
      { action: "Decrease font size", keys: ["⌘/Ctrl", "-"] },
    ],
  },
];

const KEY_BADGE_CLASS =
  "inline-flex min-w-5 items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-[10px]";

export default function ShortcutsPanel({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    requestAnimationFrame(() => {
      const firstBtn = panelRef.current?.querySelector(
        "button, [tabindex='0']",
      ) as HTMLElement | null;
      firstBtn?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKey);
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label="Keyboard shortcuts"
    >
      <div className="absolute inset-0 bg-background/50" onClick={onClose} />
      <div
        ref={panelRef}
        className={[
          "relative z-10 w-full max-w-sm rounded-lg border bg-card text-card-foreground shadow-2xl",
          "outline-none",
        ].join(" ")}
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "scale(1)" : "scale(0.95)",
          transition: "opacity 150ms ease-out, transform 150ms ease-out",
        }}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 id={titleId} className="font-semibold text-sm">
            Keyboard Shortcuts
          </h2>
          <button
            aria-label="Close shortcuts panel"
            className="inline-flex cursor-pointer items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            type="button"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-4 px-4 py-3">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                {section.title}
              </h3>
              <ul className="space-y-1.5">
                {section.shortcuts.map((s) => (
                  <li
                    key={s.action}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground">{s.action}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd key={k} className={KEY_BADGE_CLASS} aria-label={k}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="border-t px-4 py-2.5 text-center text-muted-foreground/60 text-xs">
          CodeSync
        </div>
      </div>
    </div>
  );
}
