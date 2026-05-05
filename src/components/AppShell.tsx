import { type ReactNode, useState } from "react";
import { Toaster } from "react-hot-toast";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/theme/ThemeProvider";

export type AppShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * AppShell: shared layout wrapper (header, main, toaster, theming)
 * - Sticky header with logo + Theme switcher
 * - Skip-to-content link for a11y
 * - Responsive container
 */
export default function AppShell({ children, className }: AppShellProps) {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  return (
    <ThemeProvider>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
        href="#content"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className="flex h-14 items-center justify-between">
            <a
              className="group -mx-1.5 inline-flex shrink-0 items-center gap-2.5 rounded-md px-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/"
            >
              <div
                aria-label="CodeSync logo"
                className="h-7 w-7 rounded-sm bg-center bg-contain bg-no-repeat"
                role="img"
                style={{ backgroundImage: "url('/mainlogo.png')" }}
              />
              <span className="font-semibold tracking-tight">CodeSync</span>
              <span className="hidden text-muted-foreground text-xs transition-colors group-hover:text-foreground lg:inline-block">
                Realtime Code Collaboration
              </span>
            </a>

            <nav className="flex flex-nowrap items-center gap-2">
              {/* Desktop Theme Switcher */}
              <div className="hidden sm:block">
                <ThemeSwitcher />
              </div>

              {/* Mobile Menu Button */}
              <button
                aria-label="Toggle menu"
                className="relative cursor-pointer rounded-md p-2 transition-colors hover:bg-accent sm:hidden"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                type="button"
              >
                <div
                  className={cn(
                    "h-0.5 w-5 bg-foreground transition-all duration-300",
                    isMenuOpen && "translate-y-1.5 rotate-45"
                  )}
                />
                <div
                  className={cn(
                    "mt-1 h-0.5 w-5 bg-foreground transition-all duration-300",
                    isMenuOpen && "opacity-0"
                  )}
                />
                <div
                  className={cn(
                    "mt-1 h-0.5 w-5 bg-foreground transition-all duration-300",
                    isMenuOpen && "-rotate-45 -translate-y-1.5"
                  )}
                />
              </button>
            </nav>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div className="border-t bg-background/95 backdrop-blur-sm sm:hidden">
            <div className="mx-auto max-w-7xl px-3 py-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="shrink-0">
                    <ThemeSwitcher />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <main
        className={cn("h-[calc(100svh-56px)] overflow-auto", className)}
        id="content"
      >
        {children}
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          className: "text-sm",
          success: {
            style: {
              background: "var(--accent)",
              color: "var(--accent-foreground)",
            },
          },
          error: {
            style: { background: "oklch(0.577 0.245 27.325)", color: "white" },
          },
        }}
      />
    </ThemeProvider>
  );
}
