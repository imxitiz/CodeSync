import { useEffect, useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { ACTIONS } from '../../action';

const Editor = ({
  socketRef,
  roomId,
  onCodeChange,
  editable,
  currentEditor,
  setCurrentEditor,
  firstTimesentCode,
}) => {
  const [code, setCode] = useState('');
  const extensions = [javascript({ jsx: true })];

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
  }, [code, onCodeChange, socketRef]);

  useEffect(() => {
    if (firstTimesentCode) {
      setCode(firstTimesentCode);
      onCodeChange(firstTimesentCode);
    }
  }, []);

  return (
    <CodeMirror
      value={code}
      height="100%"
      theme={dracula}
      extensions={extensions}
      onChange={handleChange}
      readOnly={!editable}
    />
  );
};

export default Editor;
