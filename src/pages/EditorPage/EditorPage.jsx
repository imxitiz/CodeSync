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
import { RiSidebarFoldFill, RiSidebarUnfoldFill } from 'react-icons/ri';
import { MdTextDecrease, MdTextIncrease } from 'react-icons/md';

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [currentEditor, setCurrentEditor] = useState('');
  const currentEditorRef = useRef(currentEditor);
  const [roomCreator, setRoomCreator] = useState(null);
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const userName = location.state?.userName || 'User';
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const handleErrors = (err) => {
    toast.error('Connection failed, please try again');
    sessionStorage.setItem("admin", userName);
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

  const toggleSidebarVisibility = () => {
    setIsSidebarVisible(!isSidebarVisible);
  };

  const leaveRoom = () => {
    if (sessionStorage.getItem("admin") === roomCreator) {
      sessionStorage.removeItem("admin");
    }
    navigate('/');
  };

  const fontSizeChange = (change) => {
    const root = document.documentElement;
    const currentSize = parseInt(
      getComputedStyle(root).getPropertyValue("--editor-font-size") || 16
    );
    const newSize = Math.max(8, Math.min(currentSize + change, 36)); 
    root.style.setProperty("--editor-font-size", `${newSize}px`);
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
      if (roomCreator !== userName) {
        return toast.error('Only the room creator can change the editable state');
      }
      // if (roomCreator === userName && currentEditor !== '') {
        
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
    document.title = `${id} - CodeSync`;

    const init = async () => {
      socketRef.current = await initSocket();

      socketRef.current.on('connect_error', handleErrors);
      socketRef.current.on('connect_failed', handleErrors);

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId: id,
        userName,
      });

      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId, roomcreator }) => {
        setClients(clients);
        setRoomCreator(roomcreator);
        if (username === userName && roomcreator === username) {
          if (sessionStorage.getItem('admin') !== roomcreator && clients.length !== 1) {
            toast.error(`${username} is already in the ${id} room.\nPlease try another UserName!`);
            navigate(`/`, {
              state: { id },
            });
          }
        }
        if (roomCreator === username || clients.length === 1) {
          sessionStorage.setItem('admin', username);
        }
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

      socketRef.current.on(ACTIONS.DUPLICATE_USER, ({ username }) => {
        toast.error(`${username} is already in the ${id} room.\nPlease try another UserName!`);
        navigate(`/`, {
          state: { id },
        });
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
        if (currenteditor === userName) {
          toast.success('You are now the editor');
        }
        if (currenteditor === '' && userName === roomCreator) {
          toast.success(`${currentEditorRef.current} have released the control`);
        }
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

  useEffect(() => {
    if (!location.state) {
      if (id) {
        navigate(`/`, {
          state: { id },
        });
      } else {
        navigate(`/`);
      }
    }
  }, [location.state, id, navigate]);

  const copyCode = async () => {
    try {
      if (!codeRef.current) return toast.error('No code to copy');
      await navigator.clipboard.writeText(codeRef.current);
      toast.success('Code copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy code , please try again');
    }
  };

  const handleUserDoubleClick = (username) => {
    setCurrentEditor(username);
    toast.success(`${username} can now edit the code`);
    socketRef.current.emit(ACTIONS.SET_CURRENT_EDITOR, {
      roomId: id,
      currenteditor: username,
    });
  };

  return (
    <div className={`mainWrap ${isSidebarVisible ? '' : 'collapsed'}`}>
      <div className={`aside ${isSidebarVisible ? '' : 'hidden'}`}>
        <div className="asideInner">
          <div className="logo">
            <img src="/mainlogo.png" alt="logoImage" className="logoimage" />
          </div>
          <h4>Room Id: {id} <br />
            Welcome, {userName}</h4>
          {currentEditor && <h3>Editor: {currentEditor}</h3>}
          <hr />
          <div className="clientslist">
            {clients
              ?.sort((a, b) => (a.username === roomCreator ? -1 : b.username === roomCreator ? 1 : 0))
              .map(({ socketId, username }) => (
                <div key={socketId}
                  onDoubleClick={roomCreator === userName ? () => handleUserDoubleClick(username) : undefined}
                >
                  <Client username={username} roomcreator={roomCreator} />
                </div>
              ))}
          </div>
        </div>
        <hr />
        <div className="accessibilitybuttons">
          <MdTextIncrease className='btn copybtn' size={20} onClick={()=>fontSizeChange(2)}/>
          <MdTextDecrease className='btn copybtn' size={20} onClick={()=>fontSizeChange(-2)}/>
        </div>
        <hr />
        <div className="controlbuttons">
          {(currentEditor === userName || roomCreator === userName && currentEditor !== '') && (
            <button className={`btn togglebtn copybtn ${currentEditor === userName && 'leavebtn'}`}
              onClick={toggleEditable}
              disabled={!(currentEditor === userName || roomCreator === userName)}
            >
              {
                currentEditor === userName ?
                  'Release Control' :
                  roomCreator === userName ?
                    'Take Control' :
                    'Set to Read-Only'
              }
            </button>
          )}
          <button className="btn copybtn" onClick={copyRoomId}>
            Copy Room Id
          </button>
          <button className="btn leavebtn" onClick={leaveRoom}>
            <FiLogOut /> Leave
          </button>
        </div>
      </div>
      <div className="editorWrap">
        <FaCopy size={30} className="right" onClick={copyCode} />
        <div className="sidebarToggler" onClick={toggleSidebarVisibility}>
          {isSidebarVisible ? 
            <RiSidebarFoldFill size={30}/> :
            <RiSidebarUnfoldFill size={30}/>
          }
        </div>
        <Editor
          socketRef={socketRef}
          roomId={id}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
          copyCode={copyCode}
          editable={userName === currentEditor || roomCreator === userName}
          currentEditor={currentEditor}
          setCurrentEditor={setCurrentEditor}
        />
      </div>
    </div>
  );
}

export default EditorPage;
