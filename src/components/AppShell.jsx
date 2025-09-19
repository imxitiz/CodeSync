import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/theme/ThemeProvider.jsx";
import { ThemeSwitcher } from "@/components/ThemeSwitcher.jsx";
import { cn } from "@/lib/utils";

/**
 * AppShell: shared layout wrapper (header, main, toaster, theming)
 * - Sticky header with logo + Theme switcher
 * - Skip-to-content link for a11y
 * - Responsive container
 */
export default function AppShell({ children, className }) {
  return (
    <ThemeProvider>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-7xl px-3 sm:px-4">
          <div className="flex h-14 items-center justify-between">
            <a href="/" className="group inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1.5 -mx-1.5">
              <img
                src="/mainlogo.png"
                width={28}
                height={28}
                alt="CodeSync logo"
                className="rounded-sm"
              />
              <span className="font-semibold tracking-tight">
                CodeSync
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline-block group-hover:text-foreground transition-colors">
                Realtime Code Collaboration
              </span>
            </a>

            <nav className="flex items-center gap-2 flex-nowrap">
              <ThemeSwitcher />
            </nav>
          </div>
        </div>
      </header>

      <main id="content" className={cn("h-[calc(100svh-56px)] overflow-hidden", className)}>
        {children}
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          className: "text-sm",
          success: {
            style: { background: "var(--accent)", color: "var(--accent-foreground)" },
          },
          error: {
            style: { background: "oklch(0.577 0.245 27.325)", color: "white" },
          },
        }}
      />
    </ThemeProvider>
  );
}