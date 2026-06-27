import type { RouteRecord } from "vite-react-ssg";
import { ViteReactSSG } from "vite-react-ssg";
import "./index.css";
import AppShell from "@/components/AppShell";
import { TooltipProvider } from "@/components/ui/tooltip";
import HomePageModern from "@/pages/HomePageModern/HomePageModern.tsx";

export const routes: RouteRecord[] = [
  {
    path: "/",
    element: (
      <TooltipProvider delayDuration={300}>
        <AppShell>
          <HomePageModern />
        </AppShell>
      </TooltipProvider>
    ),
    entry: "src/pages/HomePageModern/HomePageModern.tsx",
  },
  {
    path: "/editor/:id",
    lazy: () =>
      import("@/pages/EditorPageModern/EditorPageModern.tsx").then((mod) => ({
        Component: mod.default,
      })),
    entry: "src/pages/EditorPageModern/EditorPageModern.tsx",
  },
];

const _createRoot = ViteReactSSG({ routes });
export const createRoot = _createRoot;
export default _createRoot;
