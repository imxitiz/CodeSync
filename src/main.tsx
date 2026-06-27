import { ViteReactSSG } from "vite-react-ssg";
import "./index.css";
import HomePageModern from "@/pages/HomePageModern/HomePageModern.tsx";

const routes = [
  {
    path: "/",
    element: <HomePageModern />,
  },
  {
    path: "/editor/:id",
    lazy: () =>
      import("@/pages/EditorPageModern/EditorPageModern.tsx").then((mod) => ({
        Component: mod.default,
      })),
  },
];

export const createRoot = ViteReactSSG({ routes });
