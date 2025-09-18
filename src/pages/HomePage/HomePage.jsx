import { useEffect, useState } from 'react';
import './HomePage.css';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { wakeUpServer, waitForServerHealth } from '../../utils/healthCheck';

function HomePage() {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [serverStatusMessage, setServerStatusMessage] = useState('');

  useEffect(() => {
    const id = location.state?.id || null;
    if (id) {
      setRoomId(id);
    }
    
    // Wake up server immediately when page loads
    wakeUpServer();
  }, [location.state]);

  const handleHealthCheck = (attempt, maxRetries) => {
    setServerStatusMessage(`Waking up server... (${attempt}/${maxRetries})`);
  };

  const createnewroom = (e) => {
    e.preventDefault();
    const id = uuidv4();
    setRoomId(id);
    toast.success('New room created');
  };

  const joinRoom = async (e) => {
    e.preventDefault();
    if (roomId === '') {
      toast.error('Room id is required');
      return;
    }
    
    let finalUserName = userName;
    if (userName === '') {
      finalUserName = 'User' + Math.floor(Math.random() * 1000);
      setUserName(finalUserName);
    }

    // Check server health before navigating
    setIsCheckingServer(true);
    setServerStatusMessage('Checking server connection...');
    
    try {
      const isServerHealthy = await waitForServerHealth({
        maxRetries: 5,
        retryDelay: 2000,
        timeout: 8000,
        onRetry: handleHealthCheck
      });

      if (isServerHealthy) {
        setServerStatusMessage('Server connected! Joining room...');
        navigate(`/editor/${roomId}`, {
          state: { 
            userName: finalUserName,
            serverHealthy: true 
          },
        });
      } else {
        setServerStatusMessage('');
        toast.error('Server is not responding. Please try again later.');
      }
    } catch (error) {
      setServerStatusMessage('');
      toast.error('Failed to connect to server. Please try again.');
    } finally {
      setIsCheckingServer(false);
    }
  };

  const handelkeyenter = (e) => {
    if (e.key === 'Enter') {
      joinRoom(e);
    }
  };

  return (
    <div className="homepagewrapper">
      <div className="formwrapper">
        <img className="homepagelogo" src="/mainlogo.png" alt="SachinThapa" />
        <h4 className="mainlabel">Paste The Invitation Room Id </h4>
        <div className="inputgroup">
          <input
            type="text"
            className="inputbox"
            placeholder="ROOM ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyUp={handelkeyenter}
          />
          <input
            type="text"
            className="inputbox"
            placeholder="UserName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onDoubleClick={() => setUserName('User' + Math.floor(Math.random() * 1000))}
            onKeyUp={handelkeyenter}
          />
          <button className="btn joinbtn" onClick={joinRoom} disabled={isCheckingServer}>
            {isCheckingServer ? 'Connecting...' : 'Join'}
          </button>
          {serverStatusMessage && (
            <div className="server-status-message">
              {serverStatusMessage}
            </div>
          )}
          <span className="createinfo">
            If You Don't Have An Invite
            <a className="createnewbtn" onClick={createnewroom}>
              New Room
            </a>
          </span>
        </div>
      </div>
      <footer className="home-footer">
        <div className="home-footer-inner">
          <span className="footer-created">Created by <a href="https://github.com/sachinthapa572" target="_blank" rel="noreferrer">Sachin Thapa</a></span>
          <span className="footer-sep">·</span>
          <span className="footer-maintainer">Maintainer: <a className="maintainer-name" href="https://github.com/imxitiz" target="_blank" rel="noreferrer">Kshitiz</a></span>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
