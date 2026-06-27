import { lazy, memo, Suspense, useEffect, useState } from "react";
import type { EditorProps } from "./Editor";

export type { EditorProps } from "./Editor";

const Editor = lazy(() => import("./Editor"));

const EditorLoading: React.FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      background: "var(--card, #1a1a1a)",
      color: "var(--foreground, #f8f8f2)",
      fontFamily: "monospace",
      fontSize: "14px",
    }}
  >
    <div style={{ textAlign: "center", padding: "20px" }}>
      <div style={{ marginBottom: "10px", fontSize: "16px" }}>
        Loading Editor...
      </div>
      <div
        style={{
          width: "40px",
          height: "4px",
          background: "var(--muted, #44475a)",
          borderRadius: "2px",
          overflow: "hidden",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "var(--primary, #888)",
            animation: "loading 1.5s infinite ease-in-out",
            borderRadius: "2px",
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
