import { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme/ThemeProvider.jsx";
import { createThemesFromCss, createThemeFromCss, getSystemMode, applyTheme, presetThemes } from "@/theme/themes.js";
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
import { X, Monitor } from "lucide-react";

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
  const { themeKey, currentMode, setThemeKey, setCurrentMode, themes, addCustomTheme, removeCustomTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [prevThemeKey, setPrevThemeKey] = useState(themeKey);
  const [previewMode, setPreviewMode] = useState("dark"); // 'dark' | 'light' for preview/import default
  const [siteMode, setSiteMode] = useState(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const [selectOpen, setSelectOpen] = useState(false); // Track if select dropdown is open
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const trackRef = useRef(null);

  // Handle drag functionality
  const handleMouseDown = (e) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    
    if (percentage < 0.33) {
      if (availableModes.includes("light")) setCurrentMode("light");
    } else if (percentage < 0.67) {
      setCurrentMode("auto");
    } else {
      if (availableModes.includes("dark")) setCurrentMode("dark");
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for mobile
  const handleTouchStart = (e) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !trackRef.current) return;
    
    const touch = e.touches[0];
    const rect = trackRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = x / rect.width;
    
    if (percentage < 0.33) {
      if (availableModes.includes("light")) setCurrentMode("light");
    } else if (percentage < 0.67) {
      setCurrentMode("auto");
    } else {
      if (availableModes.includes("dark")) setCurrentMode("dark");
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Get current theme info
  const currentTheme = themes[themeKey] || themes["system"];
  const availableModes = currentTheme?.modes ? Object.keys(currentTheme.modes) : [currentTheme?.mode || "light"];
  const canSwitchModes = availableModes.length > 1;

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging]);

  // Sync siteMode with actual class
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setSiteMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggleSiteMode = () => {
    const root = document.documentElement;
    root.classList.toggle('dark');
    setSiteMode(root.classList.contains('dark') ? 'dark' : 'light');
  };

  const items = useMemo(() => {
    const base = Object.entries(themes).map(([key, t]) => {
      // Handle new theme format with modes
      if (t?.modes) {
        const availableModes = Object.keys(t.modes);
        const currentThemeMode = currentMode === "auto" ? (t.defaultMode || "dark") : currentMode;
        return {
          key,
          name: t.name || key,
          mode: currentThemeMode,
          availableModes,
          isCustom: !presetThemes[key],
        };
      }
      // Legacy format
      return {
        key,
        name: t?.name || key,
        mode: t?.mode || "light",
        availableModes: [t?.mode || "light"],
        isCustom: !presetThemes[key],
      };
    });
    // Prepend System (auto)
    return [{ key: "system-auto", name: "System (auto)", mode: getSystemMode(), availableModes: ["light", "dark"], isCustom: false }, ...base];
  }, [themes, currentMode]);

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

      // Check if it's a tweakcn URL
      if (raw.startsWith("https://tweakcn.com/r/themes/") && raw.endsWith(".json")) {
        // Try direct fetch first (might work in some environments)
        fetch(raw)
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            return res.json();
          })
          .then(data => {
            if (data.cssVars && (data.cssVars.light || data.cssVars.dark)) {
              const baseName = data.name || "custom";
              const themeTokens = data.cssVars.theme || {};
              const created = {};
              const modes = {};

              if (data.cssVars.light) {
                modes.light = { ...themeTokens, ...data.cssVars.light };
              }
              if (data.cssVars.dark) {
                modes.dark = { ...themeTokens, ...data.cssVars.dark };
              }

              // If only one mode exists, duplicate it
              if (modes.light && !modes.dark) {
                modes.dark = { ...modes.light };
              } else if (modes.dark && !modes.light) {
                modes.light = { ...modes.dark };
              }

              const key = slugify(baseName);
              const theme = {
                name: baseName,
                modes,
                defaultMode: previewMode === "dark" ? "dark" : "light"
              };

              if (customCount >= 10) {
                alert("Theme limit reached (max 10 custom themes). Delete some before adding new ones.");
                return;
              }

              addCustomTheme(key, theme);
              setThemeKey(key);
              setOpen(false);
              setText("");
              if (fileInputRef.current) fileInputRef.current.value = "";
            } else {
              throw new Error("Invalid theme format - missing cssVars.light or cssVars.dark");
            }
          })
          .catch(err => {
            if (err.message.includes('CORS') || err.message.includes('fetch')) {
              alert(`CORS error: Open ${raw} in a new tab, copy the JSON content, and paste it here instead.`);
            } else {
              alert(`Failed to fetch theme: ${err.message}`);
            }
          });
        return;
      }

      // If input looks like CSS from tweakcn
      const looksCss =
        raw.startsWith(":root") ||
        raw.includes(":root {") ||
        raw.includes(".dark") ||
        raw.includes("--background:");

      if (looksCss) {
        const baseName =
          prompt("Name your theme base (used for light/dark pair):", "custom") || "custom";
        const theme = createThemeFromCss(baseName, raw);
        if (!theme.modes || Object.keys(theme.modes).length === 0) throw new Error("No CSS variables found.");

        const key = slugify(baseName);
        if (customCount >= 10) {
          alert("Theme limit reached (max 10 custom themes). Delete some before adding new ones.");
          return;
        }

        addCustomTheme(key, theme);
        setThemeKey(key);
        setOpen(false);
        setText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Otherwise expect JSON registry-like or simple theme JSON
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");

      // Accept tweakcn registry format
      if (parsed.cssVars && (parsed.cssVars.light || parsed.cssVars.dark)) {
        const baseName = parsed.name || "custom";
        const created = {};
        const themeTokens = parsed.cssVars.theme || {};
        const modes = {};

        if (parsed.cssVars.light) {
          modes.light = { ...themeTokens, ...parsed.cssVars.light };
        }
        if (parsed.cssVars.dark) {
          modes.dark = { ...themeTokens, ...parsed.cssVars.dark };
        }

        // If only one mode exists, duplicate it
        if (modes.light && !modes.dark) {
          modes.dark = { ...modes.light };
        } else if (modes.dark && !modes.light) {
          modes.light = { ...modes.dark };
        }

        const key = slugify(baseName);
        const theme = {
          name: baseName,
          modes,
          defaultMode: previewMode === "dark" ? "dark" : "light"
        };

        if (customCount >= 10) {
          alert("Theme limit reached (max 10 custom themes). Delete some before adding new ones.");
          return;
        }

        addCustomTheme(key, theme);
        setThemeKey(key);
      } else if ("name" in parsed && "mode" in parsed && "tokens" in parsed) {
        const { name, mode, tokens } = parsed;
        if (!name || !tokens || (mode !== "light" && mode !== "dark")) {
          throw new Error("Theme must include: name (string), mode ('light'|'dark'), tokens (object)");
        }
        if (customCount >= 10) {
          alert("Theme limit reached (max 10 custom themes). Delete some before adding new ones.");
          return;
        }
        const key = slugify(name);
        addCustomTheme(key, { name, mode, tokens });
        setThemeKey(key);
      } else {
        throw new Error("Unsupported JSON format. Provide tweakcn registry format or {name,mode,tokens}.");
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
        open={selectOpen}
        onOpenChange={setSelectOpen}
      >
        <SelectTrigger className="min-w-[180px] w-[220px] max-w-[60vw] whitespace-nowrap truncate cursor-pointer" aria-label="Select theme">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectViewport>
            <SelectGroup>
              {items.map(({ key, name, mode, isCustom }) => (
                <SelectItem key={key} value={key} className="cursor-pointer">
                  <div className="flex w-full items-center justify-between gap-2 group">
                    <span className={cn("truncate", (themeKey || "system-auto") === key ? "font-semibold text-foreground" : "")}>
                      {name} ({mode})
                    </span>
                    {isCustom && (selectOpen || true) ? ( // Always show for now, can refine later
                      <button
                        type="button"
                        className="text-xs rounded border px-1.5 py-0.5 hover:bg-destructive/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
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

      {/* Modern Theme Mode Toggle */}
      {canSwitchModes && (
        <div className="relative select-none">
          {/* Toggle Track with better visibility */}
          <div 
            ref={trackRef}
            className="relative w-20 h-8 bg-primary/20 rounded-full border border-primary/30 shadow-inner cursor-pointer"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {/* Position Dots - More visible with theme colors */}
            <div className="absolute top-1/2 left-2.5 w-1 h-1 bg-foreground/60 rounded-full transform -translate-y-1/2" />
            <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-foreground/60 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute top-1/2 right-2.5 w-1 h-1 bg-foreground/60 rounded-full transform -translate-y-1/2" />
            
            {/* Sliding Knob - Draggable */}
            <div 
              className={cn(
                "absolute top-0.5 w-7 h-7 bg-card rounded-full shadow-lg border border-primary/40 z-10 flex items-center justify-center transition-transform duration-150 ease-out",
                "cursor-grab active:cursor-grabbing select-none",
                isDragging && "shadow-xl scale-105",
                currentMode === "light" && "left-0.5",
                currentMode === "auto" && "left-[26px]", 
                currentMode === "dark" && "left-[45px]"
              )}
            >
              {/* Knob Icon */}
              {currentMode === "light" && <span className="text-yellow-500 text-xs pointer-events-none">☀️</span>}
              {currentMode === "auto" && <Monitor className="w-3 h-3 text-primary pointer-events-none" />}
              {currentMode === "dark" && <span className="text-blue-400 text-xs pointer-events-none">🌙</span>}
            </div>
            
            {/* Large Click Areas for easier interaction */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMode("light");
              }}
              disabled={!availableModes.includes("light")}
              className="absolute left-0 top-0 w-7 h-8 cursor-pointer bg-transparent hover:bg-primary/10 rounded-l-full"
              title="Light mode"
              aria-label="Switch to light mode"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMode("auto");
              }}
              className="absolute left-[26px] top-0 w-7 h-8 cursor-pointer bg-transparent hover:bg-primary/10"
              title="Auto mode (follows system)"
              aria-label="Switch to auto mode"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentMode("dark");
              }}
              disabled={!availableModes.includes("dark")}
              className="absolute right-0 top-0 w-7 h-8 cursor-pointer bg-transparent hover:bg-primary/10 rounded-r-full"
              title="Dark mode"
              aria-label="Switch to dark mode"
            />
          </div>
        </div>
      )}

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
                  Paste a tweakcn URL (https://tweakcn.com/r/themes/name.json), JSON theme, or CSS variables, or pick a file below. If CORS blocks the URL, open it in a new tab and paste the JSON content directly.
                </p>
                <p className="text-xs text-muted-foreground">
                  Import tips: choose "Preview as" Dark or Light below. The chosen side is used for preview and which side opens by default after Save. Default is Dark. Both Light and Dark variants are always imported when available.
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
                placeholder="Paste tweakcn URL, JSON theme, or CSS vars (:root { ... } .dark { ... })"
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
                        const theme = createThemeFromCss(baseName, raw);
                        const modeToUse = previewMode === "dark" ? "dark" : "light";
                        applyTheme(theme, modeToUse);
                        setIsPreviewing(true);
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
                          const themeTokens = parsed.cssVars.theme || {};
                          const modes = {};

                          if (parsed.cssVars.light) {
                            modes.light = { ...themeTokens, ...parsed.cssVars.light };
                          }
                          if (parsed.cssVars.dark) {
                            modes.dark = { ...themeTokens, ...parsed.cssVars.dark };
                          }

                          // If only one mode exists, duplicate it
                          if (modes.light && !modes.dark) {
                            modes.dark = { ...modes.light };
                          } else if (modes.dark && !modes.light) {
                            modes.light = { ...modes.dark };
                          }

                          const theme = {
                            name: baseName,
                            modes,
                            defaultMode: previewMode === "dark" ? "dark" : "light"
                          };

                          const modeToUse = previewMode === "dark" ? "dark" : "light";
                          applyTheme(theme, modeToUse);
                          setIsPreviewing(true);
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