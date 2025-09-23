// Service Worker cache detection and handling utilities - Clean version

/**
 * Check if the current page is being served from a service worker cache
 * @returns boolean - True if served from SW cache, false otherwise
 */
export function isServedFromServiceWorker(): boolean {
  try {
    let swIndicators = 0;

    // Method 1: Check if navigator.serviceWorker.controller exists
    if (navigator?.serviceWorker?.controller) {
      swIndicators++;
    }

    // Method 2: Check performance entries for SW intercept
    if (performance?.getEntriesByType) {
      const entries = performance.getEntriesByType("navigation");
      if (entries.length > 0) {
        const navigation = entries[0] as PerformanceNavigationTiming;

        // Zero or very small transfer size indicates cache
        if (navigation.transferSize === 0) {
          swIndicators++;
        }

        // Check for specific SW patterns
        if (navigation.type === "reload" && navigation.transferSize < 1000) {
          swIndicators++;
        }
      }
    }

    // Method 3: Check document readiness timing (SW cache loads faster)
    if (typeof document !== "undefined") {
      const loadTime = performance.now();
      if (document.readyState === "complete" && loadTime < 100) {
        swIndicators++;
      }
    }

    // Method 4: Check for specific SW markers in HTML
    if (typeof document !== "undefined") {
      const root = document.getElementById("root");
      if (
        root?.hasAttribute("data-server-rendered") &&
        navigator.serviceWorker?.controller
      ) {
        // If we have server-rendered content but also have a SW controller,
        // this indicates potential hydration mismatch
        swIndicators++;
      }
    }

    // Method 5: Check request headers or cache markers
    if (window?.performance) {
      const resources = performance.getEntriesByType("resource");
      const jsResources = resources.filter((r) => r.name.includes(".js"));
      const cachedResources = jsResources.filter(
        (r) => (r as PerformanceResourceTiming).transferSize === 0
      );

      if (
        cachedResources.length > 0 &&
        cachedResources.length === jsResources.length
      ) {
        swIndicators++;
      }
    }

    const isFromSw = swIndicators >= 2; // Require multiple indicators
    return isFromSw;
  } catch (_error) {
    return false;
  }
}

/**
 * Clear ViteReactSSG hydration data to force client-side rendering
 */
export function clearSSGHydrationData(): void {
  // Clear ViteReactSSG hydration data to force client-side rendering
  try {
    if (typeof window !== "undefined") {
      const windowWithProps = window as Window & {
        __staticRouterHydrationData__?: unknown;
        __VITE_REACT_SSG_HASH__?: unknown;
      };
      // biome-ignore lint/suspicious/noExplicitAny: Required for clearing SSG hydration data
      windowWithProps.__staticRouterHydrationData__ = undefined as any;
      // biome-ignore lint/suspicious/noExplicitAny: Required for clearing SSG hydration data
      windowWithProps.__VITE_REACT_SSG_HASH__ = undefined as any;

      // Also clear any SSG-related data attributes
      const root = document.getElementById("root");
      if (root) {
        root.removeAttribute("data-server-rendered");
      }
    }
  } catch (_error) {
    // Silent fail
  }
}

/**
 * Force a complete client-side render by clearing the root
 */
export function forceClientSideRender(): void {
  // Force a complete client-side render by clearing the root
  try {
    const root = document.getElementById("root");
    if (root) {
      // Clear the server-rendered content
      root.innerHTML = "";
      root.removeAttribute("data-server-rendered");
    }
  } catch (_error) {
    // Silent fail
  }
}

/**
 * Detect and handle service worker cache issues
 * @returns boolean - True if SW cache was detected and handled
 */
export function detectAndHandleServiceWorkerCache(): boolean {
  const isFromSw = isServedFromServiceWorker();

  if (isFromSw) {
    // Check if this is a problematic scenario
    const hasSsgContent = document
      .getElementById("root")
      ?.hasAttribute("data-server-rendered");
    const hasHydrationData =
      (
        window as Window & {
          __staticRouterHydrationData__?: unknown;
          __VITE_REACT_SSG_HASH__?: unknown;
        }
      ).__staticRouterHydrationData__ ||
      (
        window as Window & {
          __VITE_REACT_SSG_HASH__?: unknown;
        }
      ).__VITE_REACT_SSG_HASH__;

    if (hasSsgContent && hasHydrationData) {
      clearSSGHydrationData();
      forceClientSideRender();

      // Add markers
      (
        window as Window & {
          __SW_CACHE_LOAD__?: boolean;
          __HYDRATION_MISMATCH_FIXED__?: boolean;
        }
      ).__SW_CACHE_LOAD__ = true;
      (
        window as Window & {
          __HYDRATION_MISMATCH_FIXED__?: boolean;
        }
      ).__HYDRATION_MISMATCH_FIXED__ = true;

      return true;
    }
    if (hasSsgContent) {
      forceClientSideRender();
      (
        window as Window & {
          __SW_CACHE_LOAD__?: boolean;
        }
      ).__SW_CACHE_LOAD__ = true;

      return true;
    }

    // Even if no obvious issues, mark as SW cache load
    (
      window as Window & {
        __SW_CACHE_LOAD__?: boolean;
      }
    ).__SW_CACHE_LOAD__ = true;
  }

  return isFromSw;
}

/**
 * Invalidate problematic cache if needed
 */
export function invalidateProblemticCache(): void {
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    // Send message to SW to clear HTML cache
    navigator.serviceWorker.controller.postMessage({
      action: "CLEAR_HTML_CACHE",
    });

    // Also try to reload without cache
    setTimeout(() => {
      window.location.replace(window.location.href);
    }, 1000);
  }
}

/**
 * Setup error recovery for failed hydration
 */
export function setupHydrationErrorRecovery(): void {
  if (typeof window !== "undefined") {
    // Listen for React hydration errors
    window.addEventListener("error", (event: ErrorEvent) => {
      if (
        event.error?.message &&
        (event.error.message.includes("Hydration") ||
          event.error.message.includes("hydration") ||
          event.error.message.includes("server HTML"))
      ) {
        clearSSGHydrationData();
        forceClientSideRender();

        // Trigger a re-render by reloading without cache
        setTimeout(() => {
          window.location.replace(window.location.href);
        }, 100);
      }
    });

    // Also catch unhandled promise rejections
    window.addEventListener(
      "unhandledrejection",
      (event: PromiseRejectionEvent) => {
        if (event.reason?.message?.includes("hydration")) {
          clearSSGHydrationData();
          forceClientSideRender();

          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      }
    );
  }
}
