import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import { dracula } from "@uiw/codemirror-theme-dracula";
import CodeMirror from "@uiw/react-codemirror";
import { type RefObject, useEffect, useMemo, useState } from "react";
import { ACTIONS } from "../../action";

type CodeChangeData = {
  roomId: string;
  code: string;
  currenteditor: string;
};

type Socket = {
  emit: (event: string, data: CodeChangeData) => void;
  on: (event: string, callback: (data: CodeChangeData) => void) => void;
  off: (event: string, callback: (data: CodeChangeData) => void) => void;
};

export type EditorProps = {
  socketRef: RefObject<Socket>;
  roomId: string;
  onCodeChange: (code: string) => void;
  editable: boolean;
  currentEditor: string;
  setCurrentEditor: (editor: string) => void;
  wrap?: boolean;
  darkMode?: boolean;
};

// Added "wrap" prop to control line wrapping (true = wrap at viewport width)
// Added "darkMode" prop to switch editor theme; light uses CSS variables for colors
const Editor: React.FC<EditorProps> = ({
  socketRef,
  roomId,
  onCodeChange,
  editable,
  currentEditor,
  setCurrentEditor,
  wrap = false,
  darkMode = true,
}) => {
  const [code, setCode] = useState<string>("");

  // Minimal light theme that follows CSS variables (no external theme needed)
  const lightTheme = useMemo(
    () =>
      EditorView.theme(
        {
          "&": {
            backgroundColor: "var(--card) !important",
            color: "var(--foreground) !important",
          },
          ".cm-content": {
            caretColor: "var(--foreground)",
          },
          "&.cm-focused": { outline: "none" },
          ".cm-gutters": {
            backgroundColor: "var(--card)",
            color: "var(--muted-foreground)",
            borderRight: "1px solid var(--border)",
          },
          ".cm-activeLineGutter": {
            backgroundColor:
              "color-mix(in oklch, var(--accent) 20%, transparent)",
          },
          ".cm-activeLine": {
            backgroundColor:
              "color-mix(in oklch, var(--accent) 16%, transparent)",
          },
          ".cm-selectionBackground, & ::selection": {
            backgroundColor:
              "color-mix(in oklch, var(--primary) 24%, transparent)",
          },
        },
        { dark: false }
      ),
    []
  );

  const themeExt = darkMode ? dracula : lightTheme;

  const extensions = useMemo(() => {
    const base = [javascript({ jsx: true }), themeExt];
    if (wrap) {
      base.push(EditorView.lineWrapping);
    }
    return base;
  }, [wrap, themeExt]);

  const handleChange = (value: string): void => {
    if (!editable) {
      return;
    }

    if (editable && socketRef.current) {
      setCode(value);
      onCodeChange(value);
      socketRef.current.emit(ACTIONS.CODE_CHANGE, {
        roomId,
        code: value,
        currenteditor: currentEditor,
      });
    }
  };

  // @ts-expect-error
  useEffect(() => {
    if (socketRef.current) {
      const handleCodeChange = ({
        code: newCode,
        currenteditor,
      }: {
        code: string;
        currenteditor: string;
      }) => {
        if (newCode !== null && newCode !== code) {
          setCode(newCode);
          onCodeChange(newCode);
        }
        setCurrentEditor(currenteditor);
      };

      socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);

      return () => {
        if (socketRef.current) {
          socketRef.current.off(ACTIONS.CODE_CHANGE, handleCodeChange);
        }
      };
    }
  }, [code, onCodeChange, socketRef, setCurrentEditor]);

  return (
    <CodeMirror
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
      }}
      extensions={extensions}
      height="100%"
      onChange={handleChange}
      // theme prop left undefined for light; dark handled by dracula in extensions
      readOnly={!editable}
      style={{ height: "100%", width: "100%", minHeight: 0, minWidth: 0 }}
      theme={darkMode ? dracula : "light"}
      value={code}
      width="100%"
    />
  );
};

export default Editor;
