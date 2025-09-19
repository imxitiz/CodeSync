// Service Worker cache detection and handling utilities - Clean version
export function isServedFromServiceWorker() {
  try {
    let swIndicators = 0;
    
    // Method 1: Check if navigator.serviceWorker.controller exists
    if (typeof navigator !== 'undefined' && 
        navigator.serviceWorker && 
        navigator.serviceWorker.controller) {
      swIndicators++;
    }

    // Method 2: Check performance entries for SW intercept
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const entries = performance.getEntriesByType('navigation');
      if (entries.length > 0) {
        const navigation = entries[0];
        
        // Zero or very small transfer size indicates cache
        if (navigation.transferSize === 0) {
          swIndicators++;
        }
        
        // Check for specific SW patterns
        if (navigation.type === 'reload' && navigation.transferSize < 1000) {
          swIndicators++;
        }
      }
    }

    // Method 3: Check document readiness timing (SW cache loads faster)
    if (typeof document !== 'undefined') {
      const loadTime = performance.now();
      if (document.readyState === 'complete' && loadTime < 100) {
        swIndicators++;
      }
    }

    // Method 4: Check for specific SW markers in HTML
    if (typeof document !== 'undefined') {
      const root = document.getElementById('root');
      if (root && root.hasAttribute('data-server-rendered')) {
        // If we have server-rendered content but also have a SW controller,
        // this indicates potential hydration mismatch
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          swIndicators++;
        }
      }
    }

    // Method 5: Check request headers or cache markers
    if (typeof window !== 'undefined' && window.performance) {
      const resources = performance.getEntriesByType('resource');
      const jsResources = resources.filter(r => r.name.includes('.js'));
      const cachedResources = jsResources.filter(r => r.transferSize === 0);
      
      if (cachedResources.length > 0 && cachedResources.length === jsResources.length) {
        swIndicators++;
      }
    }

    const isFromSW = swIndicators >= 2; // Require multiple indicators
    return isFromSW;
    
  } catch (error) {
    return false;
  }
}

export function clearSSGHydrationData() {
  // Clear ViteReactSSG hydration data to force client-side rendering
  try {
    if (typeof window !== 'undefined') {
      delete window.__staticRouterHydrationData__;
      delete window.__VITE_REACT_SSG_HASH__;
      
      // Also clear any SSG-related data attributes
      const root = document.getElementById('root');
      if (root) {
        root.removeAttribute('data-server-rendered');
      }
    }
  } catch (error) {
    // Silent fail
  }
}

export function forceClientSideRender() {
  // Force a complete client-side render by clearing the root
  try {
    const root = document.getElementById('root');
    if (root) {
      // Clear the server-rendered content
      root.innerHTML = '';
      root.removeAttribute('data-server-rendered');
    }
  } catch (error) {
    // Silent fail
  }
}

export function detectAndHandleServiceWorkerCache() {
  const isFromSW = isServedFromServiceWorker();
  
  if (isFromSW) {
    // Check if this is a problematic scenario
    const hasSSGContent = document.getElementById('root')?.hasAttribute('data-server-rendered');
    const hasHydrationData = window.__staticRouterHydrationData__ || window.__VITE_REACT_SSG_HASH__;
    
    if (hasSSGContent && hasHydrationData) {
      clearSSGHydrationData();
      forceClientSideRender();
      
      // Add markers
      window.__SW_CACHE_LOAD__ = true;
      window.__HYDRATION_MISMATCH_FIXED__ = true;
      
      return true;
    } else if (hasSSGContent) {
      forceClientSideRender();
      window.__SW_CACHE_LOAD__ = true;
      
      return true;
    }
    
    // Even if no obvious issues, mark as SW cache load
    window.__SW_CACHE_LOAD__ = true;
  }
  
  return isFromSW;
}

// Add a function to handle cache invalidation if needed
export function invalidateProblemticCache() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Send message to SW to clear HTML cache
    navigator.serviceWorker.controller.postMessage({
      action: 'CLEAR_HTML_CACHE'
    });
    
    // Also try to reload without cache
    setTimeout(() => {
      window.location.reload(true);
    }, 1000);
  }
}

// Error recovery for failed hydration
export function setupHydrationErrorRecovery() {
  if (typeof window !== 'undefined') {
    // Listen for React hydration errors
    window.addEventListener('error', (event) => {
      if (event.error && event.error.message && 
          (event.error.message.includes('Hydration') || 
           event.error.message.includes('hydration') ||
           event.error.message.includes('server HTML'))) {
        
        clearSSGHydrationData();
        forceClientSideRender();
        
        // Trigger a re-render by reloading without cache
        setTimeout(() => {
          window.location.reload(true);
        }, 100);
      }
    });

    // Also catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason && event.reason.message && 
          event.reason.message.includes('hydration')) {
        
        clearSSGHydrationData();
        forceClientSideRender();
        
        setTimeout(() => {
          window.location.reload(true);
        }, 100);
      }
    });
  }
}