import { ViteReactSSG, ClientOnly } from 'vite-react-ssg';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot as createReactRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import { detectAndHandleServiceWorkerCache, setupHydrationErrorRecovery } from '@/utils/swDetection.js';
import HomePageModern from '@/pages/HomePageModern/HomePageModern.jsx';

// Setup error recovery immediately
setupHydrationErrorRecovery();

const routes = [
  {
    path: '/',
    element: <HomePageModern />,
  },
  {
    path: 'editor/:id',
    lazy: () =>
      import('@/pages/EditorPageModern/EditorPageModern.jsx').then((mod) => ({
        Component: () => <ClientOnly>{() => <mod.default />}</ClientOnly>,
      })),
  },
];

// Fallback React Router App for client-side rendering
function ClientApp() {
  const EditorPageModern = lazy(() => import('@/pages/EditorPageModern/EditorPageModern.jsx'));
  
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePageModern />} />
        <Route 
          path="/editor/:id" 
          element={
            <Suspense fallback={<div>Loading editor...</div>}>
              <EditorPageModern />
            </Suspense>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

// Enhanced initialization logic with multiple fallback strategies
function initializeApp() {
  try {
    // Strategy 1: Check if we're loading from service worker cache
    const isFromSWCache = detectAndHandleServiceWorkerCache();
    
    // Strategy 2: Check for existing hydration issues
    const hasHydrationIssues = typeof window !== 'undefined' && (
      window.__SW_CACHE_LOAD__ || 
      (window.performance && window.performance.getEntriesByType('navigation')[0]?.transferSize === 0)
    );
    
    if (isFromSWCache || hasHydrationIssues) {
      // Force client-side rendering with multiple strategies
      const forceClientRender = () => {
        const container = document.getElementById('root');
        if (container) {
          // Strategy 1: Clear and re-render
          container.innerHTML = '';
          container.removeAttribute('data-server-rendered');
          
          // Strategy 2: Create fresh React root
          try {
            const root = createReactRoot(container);
            root.render(
              <StrictMode>
                <ClientApp />
              </StrictMode>
            );
          } catch (renderError) {
            // Strategy 3: Fallback - reload page without cache
            setTimeout(() => {
              window.location.reload(true);
            }, 100);
          }
        }
      };
      
      // Execute based on DOM readiness
      if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', forceClientRender);
        } else {
          // Use setTimeout to ensure all scripts have loaded
          setTimeout(forceClientRender, 0);
        }
      }
      
      return null; // Skip ViteReactSSG completely
      
    } else {
      // Fresh load - use ViteReactSSG with enhanced error handling
      return ViteReactSSG({ 
        routes,
        wrapper: ({ children }) => (
          <StrictMode>
            {children}
          </StrictMode>
        ),
        onError: (error) => {
          // On SSG error, fall back to client-side rendering
          setTimeout(() => {
            window.__SW_CACHE_LOAD__ = true; // Mark for client render
            window.location.reload();
          }, 100);
        }
      });
    }
    
  } catch (error) {
    // Ultimate fallback - force client-side rendering
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      const container = document.getElementById('root');
      if (container) {
        try {
          container.innerHTML = '';
          const root = createReactRoot(container);
          root.render(
            <StrictMode>
              <ClientApp />
            </StrictMode>
          );
        } catch (fallbackError) {
          // Last resort - show error message
          container.innerHTML = '<div style="padding: 20px; text-align: center;">Loading failed. Please refresh the page.</div>';
        }
      }
    }
    
    return null;
  }
}

export const createRoot = initializeApp();
