import { lazy, StrictMode, Suspense } from "react";
import { createRoot as createReactRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClientOnly, ViteReactSSG } from "vite-react-ssg";
import "./index.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePageModern from "@/pages/HomePageModern/HomePageModern.tsx";
import {
  detectAndHandleServiceWorkerCache,
  setupHydrationErrorRecovery,
} from "@/utils/swDetection";

// Setup error recovery immediately
setupHydrationErrorRecovery();

const routes = [
  {
    path: "/",
    element: <HomePageModern />,
  },
  {
    path: "editor/:id",
    lazy: () =>
      import("@/pages/EditorPageModern/EditorPageModern.tsx").then((mod) => ({
        Component: () => <ClientOnly>{() => <mod.default />}</ClientOnly>,
      })),
  },
];

// Fallback React Router App for client-side rendering
function ClientApp() {
  const EditorPageModern = lazy(
    () => import("@/pages/EditorPageModern/EditorPageModern.tsx")
  );

  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <Routes>
          <Route element={<HomePageModern />} path="/" />
          <Route
            element={
              <Suspense fallback={<div>Loading editor...</div>}>
                <EditorPageModern />
              </Suspense>
            }
            path="/editor/:id"
          />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  );
}

// Enhanced initialization logic with multiple fallback strategies
function initializeApp() {
  try {
    const shouldForceClientRender = (): boolean => {
      // Strategy 1: Check if we're loading from service worker cache
      const isFromSwCache = detectAndHandleServiceWorkerCache();

      // Strategy 2: Check for existing hydration issues
      const hasHydrationIssues =
        typeof window !== "undefined" &&
        ((window as Window & { __SW_CACHE_LOAD__?: boolean })
          .__SW_CACHE_LOAD__ ||
          (window.performance &&
            (
              window.performance.getEntriesByType(
                "navigation"
              )[0] as PerformanceNavigationTiming
            )?.transferSize === 0));

      return isFromSwCache || hasHydrationIssues;
    };

    const forceClientRender = (): void => {
      const container = document.getElementById("root");
      if (container) {
        // Strategy 1: Clear and re-render
        container.innerHTML = "";
        container.removeAttribute("data-server-rendered");

        // Strategy 2: Create fresh React root
        try {
          const root = createReactRoot(container);
          root.render(
            <StrictMode>
              <ClientApp />
            </StrictMode>
          );
        } catch (_renderError) {
          // Strategy 3: Fallback - reload page without cache
          setTimeout(() => {
            window.location.replace(window.location.href);
          }, 100);
        }
      }
    };

    const setupClientRender = (): void => {
      if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", forceClientRender);
        } else {
          // Use setTimeout to ensure all scripts have loaded
          setTimeout(forceClientRender, 0);
        }
      }
    };

    const createSsgApp = () => ViteReactSSG({ routes });

    if (shouldForceClientRender()) {
      setupClientRender();
      return null; // Skip ViteReactSSG completely
    }

    // Fresh load - use ViteReactSSG with enhanced error handling
    return createSsgApp();
  } catch (_error) {
    // Ultimate fallback - force client-side rendering
    const ultimateFallback = (): void => {
      if (typeof document !== "undefined" && typeof window !== "undefined") {
        const container = document.getElementById("root");
        if (container) {
          try {
            container.innerHTML = "";
            const root = createReactRoot(container);
            root.render(
              <StrictMode>
                <ClientApp />
              </StrictMode>
            );
          } catch (_fallbackError) {
            // Last resort - show error message
            container.innerHTML =
              '<div style="padding: 20px; text-align: center;">Loading failed. Please refresh the page.</div>';
          }
        }
      }
    };

    ultimateFallback();
    return null;
  }
}

export const createRoot = initializeApp();
