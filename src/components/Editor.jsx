import { useEffect, useRef, useState, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { EditorView } from '@codemirror/view';
import { ACTIONS } from '../../action';

// Added "wrap" prop to control line wrapping (true = wrap at viewport width)
// Added "darkMode" prop to switch editor theme; light uses CSS variables for colors
const Editor = ({
  socketRef,
  roomId,
  onCodeChange,
  editable,
  currentEditor,
  setCurrentEditor,
  wrap = false,
  darkMode = true,
}) => {
  const [code, setCode] = useState('');

  // Minimal light theme that follows CSS variables (no external theme needed)
  const lightTheme = useMemo(
    () =>
      EditorView.theme(
        {
          '&': {
            backgroundColor: 'var(--card) !important',
            color: 'var(--foreground) !important',
          },
          '.cm-content': {
            caretColor: 'var(--foreground)',
          },
          '&.cm-focused': { outline: 'none' },
          '.cm-gutters': {
            backgroundColor: 'var(--card)',
            color: 'var(--muted-foreground)',
            borderRight: '1px solid var(--border)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'color-mix(in oklch, var(--accent) 20%, transparent)',
          },
          '.cm-activeLine': {
            backgroundColor: 'color-mix(in oklch, var(--accent) 16%, transparent)',
          },
          '.cm-selectionBackground, & ::selection': {
            backgroundColor: 'color-mix(in oklch, var(--primary) 24%, transparent)',
          },
        },
        { dark: false }
      ),
    []
  );

  const themeExt = darkMode ? dracula : lightTheme;

  const extensions = useMemo(() => {
    const base = [javascript({ jsx: true }), themeExt];
    if (wrap) base.push(EditorView.lineWrapping);
    return base;
  }, [wrap, themeExt]);

  const handleChange = (value) => {
    if (!editable) return;

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

  useEffect(() => {
    if (socketRef.current) {
      const handleCodeChange = ({ code: newCode, currenteditor: currenteditor }) => {
        if (newCode !== null && newCode !== code) {
          setCode(newCode);
          onCodeChange(newCode);
        }
        setCurrentEditor(currenteditor);
      };

      socketRef.current.on(ACTIONS.CODE_CHANGE, handleCodeChange);

      return () => {
        socketRef.current.off(ACTIONS.CODE_CHANGE, handleCodeChange);
      };
    }
  }, [code, onCodeChange, socketRef, setCurrentEditor]);

  return (
    <CodeMirror
      value={code}
      height="100%"
      width="100%"
      style={{ height: "100%", width: "100%", minHeight: 0, minWidth: 0 }}
      // theme prop left undefined for light; dark handled by dracula in extensions
      theme={darkMode ? dracula : undefined}
      extensions={extensions}
      onChange={handleChange}
      readOnly={!editable}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
      }}
    />
  );
};

export default Editor;
