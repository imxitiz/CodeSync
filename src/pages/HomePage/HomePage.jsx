import { useEffect, useState } from 'react';
import './HomePage.css';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';

function HomePage() {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const id = location.state?.id || null;
    if (id) {
      setRoomId(id);
    }
  }, [location.state]);

  const createnewroom = (e) => {
    e.preventDefault();
    const id = uuidv4();
    setRoomId(id);
    toast.success('New room created');
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomId === '') {
      toast.error('Room id is required');
      return;
    }
    if (userName === '') {
      const name = 'User' + Math.floor(Math.random() * 1000);
      setUserName(name);
    }

    // Use a callback to ensure userName has been updated before navigating
    if (userName !== '') {
      navigate(`/editor/${roomId}`, {
        state: { userName },
      });
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
          <button className="btn joinbtn" onClick={joinRoom}>
            Join
          </button>
          <span className="createinfo">
            If You Don’t Have An Invite
            <a className="createnewbtn" onClick={createnewroom}>
              New Room
            </a>
          </span>
        </div>
      </div>
      <footer>
        <h4>
          created by <a href="https://github.com/sachinthapa572">Sachin Thapa</a>
        </h4>
      </footer>
    </div>
  );
}

export default HomePage;
