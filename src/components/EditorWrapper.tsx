import { lazy, memo, Suspense, useEffect, useState } from "react";
import type { EditorProps } from "./Editor";

export type { EditorProps } from "./Editor";

const Editor = lazy(() => import("./Editor"));

const EditorLoading: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center bg-card font-mono text-sm">
    <div className="text-center">
      <div className="mb-2 text-base">Loading Editor...</div>
      <div className="mx-auto h-1 w-10 overflow-hidden rounded-sm bg-muted">
        <div
          className="h-full w-full animate-[loading_1.5s_infinite_ease-in-out] rounded-sm bg-primary"
          style={{
            animation: "loading 1.5s infinite ease-in-out",
          }}
        />
      </div>
      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  </div>
);

const EditorWrapper: React.FC<EditorProps> = (props) => {
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <EditorLoading />;
  }

  return (
    <div style={{ height: "100%", width: "100%", minHeight: 0, minWidth: 0 }}>
      <Suspense fallback={<EditorLoading />}>
        <div
          style={{ height: "100%", width: "100%", minHeight: 0, minWidth: 0 }}
        >
          <Editor {...props} />
        </div>
      </Suspense>
    </div>
  );
};

export default memo(EditorWrapper);
