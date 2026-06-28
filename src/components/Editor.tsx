import { javascript } from "@codemirror/lang-javascript";
import { EditorView } from "@codemirror/view";
import { dracula } from "@uiw/codemirror-theme-dracula";
import CodeMirror from "@uiw/react-codemirror";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorSocketRef } from "@/pages/EditorPageModern/types";
import { ACTIONS } from "../utils/constants";

type IncomingCodeChange = {
  tabId?: string;
  code: string;
  currenteditor?: string;
};

export type EditorProps = {
  socketRef: EditorSocketRef;
  socketReady: boolean;
  roomId: string;
  activeTabId: string;
  initialCode: string;
  onCodeChange: (code: string, tabId: string) => void;
  editable: boolean;
  currentEditor: string;
  setCurrentEditor: (editor: string) => void;
  wrap?: boolean;
  darkMode?: boolean;
  fontSize?: number;
};

const Editor: React.FC<EditorProps> = ({
  socketRef,
  socketReady,
  roomId,
  activeTabId,
  initialCode,
  onCodeChange,
  editable,
  currentEditor,
  setCurrentEditor,
  wrap = false,
  darkMode = true,
  fontSize = 16,
}) => {
  const [code, setCode] = useState<string>(initialCode);
  const activeTabIdRef = useRef(activeTabId);
  const codeRef = useRef(initialCode);
  const currentEditorRef = useRef(currentEditor);
  const onCodeChangeRef = useRef(onCodeChange);
  const editorViewRef = useRef<EditorView | null>(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  useEffect(() => {
    currentEditorRef.current = currentEditor;
  }, [currentEditor]);

  useEffect(() => {
    onCodeChangeRef.current = onCodeChange;
  }, [onCodeChange]);

  const applyRemoteCode = useCallback((newCode: string) => {
    const view = editorViewRef.current;
    if (view) {
      const currentDoc = view.state.doc.toString();
      if (currentDoc !== newCode) {
        isInternalChange.current = true;
        view.dispatch({
          changes: {
            from: 0,
            to: currentDoc.length,
            insert: newCode,
          },
        });
        isInternalChange.current = false;
      }
    } else {
      setCode(newCode);
    }
    codeRef.current = newCode;
  }, []);

  useEffect(() => {
    codeRef.current = initialCode;
    setCode(initialCode);
    if (editorViewRef.current) {
      applyRemoteCode(initialCode);
    }
  }, [initialCode, applyRemoteCode]);

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
        { dark: false },
      ),
    [],
  );

  const themeExt = darkMode ? dracula : lightTheme;

  const fontSizeTheme = useMemo(
    () =>
      EditorView.theme({
        "&": { fontSize: `${fontSize}px` },
      }),
    [fontSize],
  );

  const extensions = useMemo(() => {
    const base = [javascript({ jsx: true }), themeExt, fontSizeTheme];
    if (wrap) {
      base.push(EditorView.lineWrapping);
    }
    return base;
  }, [wrap, themeExt, fontSizeTheme]);

  const handleChange = (value: string): void => {
    if (isInternalChange.current) {
      return;
    }
    if (!(editable && socketRef.current)) {
      return;
    }

    codeRef.current = value;
    setCode(value);
    onCodeChangeRef.current(value, activeTabId);
    socketRef.current.emit(ACTIONS.CODE_CHANGE, {
      roomId,
      tabId: activeTabId,
      code: value,
      currenteditor: currentEditorRef.current,
    });
  };

  const handleCreateEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!(socket && socketReady)) {
      return;
    }

    const handleCodeChange = ({
      tabId: incomingTabId,
      code: newCode,
      currenteditor,
    }: IncomingCodeChange) => {
      const targetTabId = incomingTabId || activeTabIdRef.current;
      onCodeChangeRef.current(newCode, targetTabId);
      if (
        targetTabId === activeTabIdRef.current &&
        newCode !== codeRef.current
      ) {
        applyRemoteCode(newCode);
      }
      if (currenteditor !== undefined) {
        setCurrentEditor(currenteditor);
      }
    };

    const handleTabCode = ({
      tabId: incomingTabId,
      code: newCode,
    }: IncomingCodeChange) => {
      if (
        incomingTabId === activeTabIdRef.current &&
        newCode !== codeRef.current
      ) {
        applyRemoteCode(newCode);
        onCodeChangeRef.current(
          newCode,
          incomingTabId ?? activeTabIdRef.current,
        );
      }
    };

    socket.on(ACTIONS.CODE_CHANGE, handleCodeChange);
    socket.on(ACTIONS.TAB_CODE, handleTabCode);

    return () => {
      socket.off(ACTIONS.CODE_CHANGE, handleCodeChange);
      socket.off(ACTIONS.TAB_CODE, handleTabCode);
    };
  }, [socketRef, socketReady, setCurrentEditor, applyRemoteCode]);

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
      onCreateEditor={handleCreateEditor}
      readOnly={!editable}
      style={{ height: "100%", width: "100%", minHeight: 0, minWidth: 0 }}
      theme={darkMode ? dracula : "light"}
      value={code}
      width="100%"
    />
  );
};

export default memo(Editor);
