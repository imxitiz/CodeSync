import { lazy, StrictMode, Suspense } from "react";
import { createRoot as createReactRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ClientOnly, ViteReactSSG } from "vite-react-ssg";
import "./index.css";
import HomePageModern from "@/pages/HomePageModern/HomePageModern.jsx";
import {
  detectAndHandleServiceWorkerCache,
  setupHydrationErrorRecovery,
} from "@/utils/swDetection.js";

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
      import("@/pages/EditorPageModern/EditorPageModern.jsx").then((mod) => ({
        Component: () => <ClientOnly>{() => <mod.default />}</ClientOnly>,
      })),
  },
];

// Fallback React Router App for client-side rendering
function ClientApp() {
  const EditorPageModern = lazy(
    () => import("@/pages/EditorPageModern/EditorPageModern.jsx")
  );

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

// Enhanced initialization logic with multiple fallback strategies
function initializeApp() {
  try {
    const shouldForceClientRender = () => {
      // Strategy 1: Check if we're loading from service worker cache
      const isFromSwCache = detectAndHandleServiceWorkerCache();

      // Strategy 2: Check for existing hydration issues
      const hasHydrationIssues =
        typeof window !== "undefined" &&
        (window.__SW_CACHE_LOAD__ ||
          (window.performance &&
            window.performance.getEntriesByType("navigation")[0]
              ?.transferSize === 0));

      return isFromSwCache || hasHydrationIssues;
    };

    const forceClientRender = () => {
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
            window.location.reload(true);
          }, 100);
        }
      }
    };

    const setupClientRender = () => {
      if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", forceClientRender);
        } else {
          // Use setTimeout to ensure all scripts have loaded
          setTimeout(forceClientRender, 0);
        }
      }
    };

    const createSsgApp = () => {
      return ViteReactSSG({
        routes,
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
        onError: (_error) => {
          // On SSG error, fall back to client-side rendering
          setTimeout(() => {
            window.__SW_CACHE_LOAD__ = true; // Mark for client render
            window.location.reload();
          }, 100);
        },
      });
    };

    if (shouldForceClientRender()) {
      setupClientRender();
      return null; // Skip ViteReactSSG completely
    }

    // Fresh load - use ViteReactSSG with enhanced error handling
    return createSsgApp();
  } catch (_error) {
    // Ultimate fallback - force client-side rendering
    const ultimateFallback = () => {
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
