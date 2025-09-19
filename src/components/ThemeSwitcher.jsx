import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider.jsx";
import { createThemesFromCss, getSystemMode, applyTheme, presetThemes } from "@/theme/themes.js";
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectSeparator,
} from "@/components/ui/select.jsx";
import { X } from "lucide-react";

function slugify(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "custom-theme"
  );
}

export function ThemeSwitcher({ className }) {
  const { themeKey, setThemeKey, themes, addCustomTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [prevThemeKey, setPrevThemeKey] = useState(themeKey);
  const [previewMode, setPreviewMode] = useState("dark"); // 'dark' | 'light' for preview/import default
  const fileInputRef = useRef(null);

  const items = useMemo(() => {
    const base = Object.entries(themes).map(([key, t]) => ({
      key,
      name: t?.name || key,
      mode: t?.mode || "light",
      isCustom: !presetThemes[key],
    }));
    // Prepend System (auto)
    return [{ key: "system-auto", name: "System (auto)", mode: getSystemMode(), isCustom: false }, ...base];
  }, [themes]);

  const onFilePick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const t = await file.text();
    setText(t);
  };

  const handleSave = () => {
    try {
      const raw = text.trim();
      const customCount = Object.keys(themes).filter((k) => !presetThemes[k]).length;

      // If input looks like CSS from tweakcn
      const looksCss =
        raw.startsWith(":root") ||
        raw.includes(":root {") ||
        raw.includes(".dark") ||
        raw.includes("--background:");

      if (looksCss) {
        const baseName =
          prompt("Name your theme base (used for light/dark pair):", "custom") || "custom";
        const created = createThemesFromCss(baseName, raw, true);
        const keys = Object.keys(created);
        if (keys.length === 0) throw new Error("No CSS variables found.");
        keys.forEach((k) => addCustomTheme(k, created[k]));
        // Pick preferred mode based on system
        const preferred =
          previewMode === "dark"
            ? `${slugify(baseName)}-dark`
            : `${slugify(baseName)}-light`;
        if (created[preferred]) setThemeKey(preferred);
        setOpen(false);
        setText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Otherwise expect JSON registry-like or simple theme JSON
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");

      // Accept two formats:
      // 1) { name, mode, tokens }
      // 2) shadcn registry-like { cssVars: { light: {...}, dark: {...} } }
      if ("name" in parsed && "mode" in parsed && "tokens" in parsed) {
        const { name, mode, tokens } = parsed;
        if (!name || !tokens || (mode !== "light" && mode !== "dark")) {
          throw new Error("Theme must include: name (string), mode ('light'|'dark'), tokens (object)");
        }
        const key = slugify(name);
        addCustomTheme(key, { name, mode, tokens });
        setThemeKey(key);
      } else if (parsed.cssVars && (parsed.cssVars.light || parsed.cssVars.dark)) {
        const baseName = parsed.name || "custom";
        const created = {};
        if (parsed.cssVars.light) {
          const key = `${slugify(baseName)}-light`;
          created[key] = { name: `${baseName} Light`, mode: "light", tokens: parsed.cssVars.light };
        }
        if (parsed.cssVars.dark) {
          const key = `${slugify(baseName)}-dark`;
          created[key] = { name: `${baseName} Dark`, mode: "dark", tokens: parsed.cssVars.dark };
        }
        const addCount = Object.keys(created).length;
        if (addCount === 0) throw new Error("No tokens found in cssVars.");
        if (customCount + addCount > 10) {
          alert("Theme limit reached (max 10 custom themes). Delete some before adding new ones.");
          return;
        }
        Object.entries(created).forEach(([k, v]) => addCustomTheme(k, v));
        const preferred =
          previewMode === "dark"
            ? `${slugify(baseName)}-dark`
            : `${slugify(baseName)}-light`;
        setThemeKey(created[preferred] ? preferred : Object.keys(created)[0]);
      } else {
        throw new Error("Unsupported JSON format. Provide {name,mode,tokens} or shadcn registry-like cssVars.");
      }

      setOpen(false);
      setText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert("Import failed. " + (err?.message || ""));
    }
  };

  return (
    <div className={cn("relative flex items-center gap-2 shrink-0 min-w-0", className)}>
      <Select
        value={themeKey || "system-auto"}
        onValueChange={(val) => {
          if (val === "__import__") setOpen(true);
          else setThemeKey(val);
        }}
      >
        <SelectTrigger className="min-w-[180px] w-[220px] max-w-[60vw] whitespace-nowrap truncate cursor-pointer" aria-label="Select theme">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectViewport>
            <SelectGroup>
              {items.map(({ key, name, mode, isCustom }) => (
                <SelectItem key={key} value={key}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={cn("truncate", (themeKey || "system-auto") === key ? "font-semibold text-foreground" : "")}>
                      {name} ({mode})
                    </span>
                    {isCustom ? (
                      <button
                        type="button"
                        className="text-xs rounded border px-1.5 py-0.5 hover:bg-destructive/10 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if ((themeKey || "system-auto") === key) {
                            setThemeKey("system-auto");
                          }
                          removeCustomTheme(key);
                        }}
                        title={`Delete ${name}`}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value="__import__">+ Import theme…</SelectItem>
            </SelectGroup>
          </SelectViewport>
        </SelectContent>
      </Select>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-theme-title"
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          tabIndex={-1}
        >
          <div
            className="absolute inset-0"
            onMouseDown={() => {
              // Close only; keep preview applied (not persisted)
              setOpen(false);
            }}
          />
          <div className="relative z-[61] w-full max-w-xl rounded-lg border bg-card text-card-foreground shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 id="import-theme-title" className="text-sm font-semibold">
                Import Theme (JSON or CSS)
              </h2>
              <button
                className="text-sm text-destructive cursor-pointer rounded-md p-1 transition hover:bg-destructive/10"
                onClick={() => {
                  // Close only; keep preview applied (not persisted)
                  setOpen(false);
                }}
                type="button"
                size="sm" 
                variant="destructive"
                >
                <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-sm text-muted-foreground">
                  Paste a JSON theme or the CSS variables from tweakcn, or pick a file below.
                </p>
                <p className="text-xs text-muted-foreground">
                  Import tips: choose “Preview as” Dark or Light below. The chosen side is used for preview and which side opens by default after Save. Default is Dark.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Preview as:</span>
                  <button
                    type="button"
                    className={cn(
                      "rounded border px-2 py-1",
                      previewMode === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                    onClick={() => setPreviewMode("dark")}
                  >
                    Dark (default)
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded border px-2 py-1",
                      previewMode === "light" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                    onClick={() => setPreviewMode("light")}
                  >
                    Light
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tip: When importing CSS from tweakcn, we generate both Light and Dark themes. The preview uses your selection above.
                </p>
                {isPreviewing && (
                  <div className="rounded-md border bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                    Previewing unsaved theme. Click Save to keep it, or Close/Click outside to keep preview (not persisted).
                  </div>
                )}
                <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.css,text/css,application/json"
                  onChange={onFilePick}
                  className="block w-full text-sm file:me-3 file:cursor-pointer file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground hover:file:bg-secondary/80"
                />
                <button
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    setText("");
                  }}
                  title="Clear input"
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <textarea
                spellCheck="false"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste JSON theme or CSS vars (:root { ... } .dark { ... })"
                className="min-h-40 w-full rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
              <a
                href="https://tweakcn.com/editor/theme"
                target="_blank"
                rel="noreferrer"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Open tweakcn.com
              </a>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
                  onClick={() => {
                    try {
                      const raw = text.trim();
                      if (!raw) return;
                      const looksCss =
                        raw.startsWith(":root") ||
                        raw.includes(":root {") ||
                        raw.includes(".dark") ||
                        raw.includes("--background:");
                      if (looksCss) {
                        const baseName = "Preview";
                        const created = createThemesFromCss(baseName, raw, true);
                        const preferred =
                          previewMode === "dark"
                            ? `${slugify(baseName)}-dark`
                            : `${slugify(baseName)}-light`;
                        const toApply =
                          created[preferred] || Object.values(created)[0];
                        if (toApply) {
                          applyTheme(toApply);
                          setIsPreviewing(true);
                        }
                        return;
                      }
                      // JSON preview
                      const parsed = JSON.parse(raw);
                      if (parsed && typeof parsed === "object") {
                        if ("name" in parsed && "mode" in parsed && "tokens" in parsed) {
                          applyTheme(parsed);
                          setIsPreviewing(true);
                          return;
                        }
                        if (parsed.cssVars && (parsed.cssVars.light || parsed.cssVars.dark)) {
                          const baseName = parsed.name || "Preview";
                          const created = {};
                          if (parsed.cssVars.light) {
                            created[`${slugify(baseName)}-light`] = {
                              name: `${baseName} Light`, mode: "light", tokens: parsed.cssVars.light
                            };
                          }
                          if (parsed.cssVars.dark) {
                            created[`${slugify(baseName)}-dark`] = {
                              name: `${baseName} Dark`, mode: "dark", tokens: parsed.cssVars.dark
                            };
                          }
                          const preferred =
                            previewMode === "dark"
                              ? `${slugify(baseName)}-dark`
                              : `${slugify(baseName)}-light`;
                          const toApply = created[preferred] || Object.values(created)[0];
                          if (toApply) {
                            applyTheme(toApply);
                            setIsPreviewing(true);
                          }
                          return;
                        }
                      }
                      alert("Nothing to preview. Provide valid CSS variables or JSON.");
                    } catch (e) {
                      alert("Preview failed. " + (e?.message || ""));
                    }
                  }}
                  title="Preview theme without saving"
                >
                  Preview
                </button>
                <button
                  onClick={handleSave}
                  type="button"
                  className="rounded-md border bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  Save theme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}