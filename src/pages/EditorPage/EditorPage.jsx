import { useEffect, useRef, useState } from 'react';
import Client from '../../components/Client';
import './EditorPage.css';
import Editor from '../../components/Editor';
import { initSocket } from '../../utils/socket';
import { ACTIONS } from '../../utils/constant';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaCopy } from "react-icons/fa";
import { FiLogOut } from 'react-icons/fi';

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [currentEditor, setCurrentEditor] = useState('');
  const currentEditorRef = useRef(currentEditor);
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const userName = location.state?.userName || 'Guest';

  const handleErrors = (err) => {
    toast.error('Connection failed, please try again');
    navigate('/');
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success('Room Id copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy Room Id');
    }
  };

  const leaveRoom = () => {
    navigate('/');
  };

  const toggleEditable = () => {
    // Check if the current user is already the editor
    if (currentEditor === userName) {
      // If the current user is the editor, release control
      setCurrentEditor('');
      toast.success("Editor is now read-only");
      socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: '',
      });
    } else {
      // If the current user is not the editor, take control
      setCurrentEditor(userName);
      toast.success("Editor is now editable");
      socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
        roomId: id,
        currenteditor: userName,
      });
    }
  };

    // Update currentEditorRef whenever currentEditor changes
  useEffect(() => {
    currentEditorRef.current = currentEditor;
  }, [currentEditor]);

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();

      socketRef.current.on('connect_error', handleErrors);
      socketRef.current.on('connect_failed', handleErrors);

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId: id,
        userName,
      });

      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        setClients(clients);
        if (username !== userName) {
          toast.success(`${username} joined the room`);
        if (codeRef.current) {
          socketRef.current.emit(ACTIONS.SYNC_CODE, {
            socketId,
            code: codeRef.current,
            currenteditor: currentEditorRef.current,
          });
        }
      }
      });

      socketRef.current.on(ACTIONS.DUPLICATE_USER, ({ socketId, username }) => {
        toast.error(`${username} is already in the room`);
        navigate('/');
      });

      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room`);
        setClients((prev) => prev.filter((client) => client.socketId !== socketId));
        if (currentEditor === username) {
          setCurrentEditor('');
          socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
            roomId: id,
            currenteditor: '',
          });
        }
      });

      socketRef.current.on(ACTIONS.SET_CURRENT_EDITOR, ({ roomId, currenteditor }) => {
        console.log('got: SET_CURRENT_EDITOR', currenteditor);
        setCurrentEditor(currenteditor);
        return () => {
          socketRef.current.off(ACTIONS.SET_CURRENT_EDITOR);
        };
      });
    };

    init();

    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.SET_CURRENT_EDITOR);
        socketRef.current.disconnect();
      }
    };
  }, []);

  if (!location.state) {
    return <Navigate to="/" />;
  }

  const copyCode = async () => {
    try {
      if (!codeRef.current) return toast.error('No code to copy');
      await navigator.clipboard.writeText(codeRef.current);
      toast.success('Code copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy code , please try again');
    }
  };

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img src="/mainlogo.png" alt="logoImage" className="logoimage" />
          </div>
          <h4>Room Id: {id} <br />
          Welcome {userName}</h4>
          <h3>{currentEditor ? `Editor: ${currentEditor}` : ''}</h3>
          <hr />
          <div className="clientslist">
            {clients?.map(({ socketId, username }) => (
              <Client username={username} key={socketId} />
            ))}
          </div>
        </div>
        <button className={`btn togglebtn copybtn`}
          onClick={toggleEditable}
          disabled={!(currentEditor === '' || currentEditor === userName)}
        >
          {currentEditor === userName ?
            'Set to Editable for others' :
            currentEditor === ''
            ? 'Set to Read-Only for others'
            : `On Readonly mode by ${currentEditor}`}
        </button>

        <button className="btn copybtn" onClick={copyRoomId}>
          Copy Room Id
        </button>
        <button className="btn leavebtn" onClick={leaveRoom}>
          <FiLogOut /> Leave
        </button>
      </div>
      <div className="editorWrap">
          <FaCopy size={30} className="right" onClick={copyCode} />
        <Editor
          socketRef={socketRef}
          roomId={id}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
          copyCode={copyCode}
          editable={userName === currentEditor || currentEditor === ''}
          currentEditor={currentEditor}
          setCurrentEditor={setCurrentEditor}
        />
      </div>
    </div>
  );
}

export default EditorPage;
