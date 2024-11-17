import Avatar from 'react-avatar';
import randomColor from 'randomcolor';
import { useRef } from 'react';
import { FaCrown } from "react-icons/fa";

function Client({ username, roomcreator }) {
  const colorRef = useRef(randomColor());
  return (
    <>
      <div className="client">
        <Avatar name={username} size={50} round="14px" color={colorRef.current} fgColor="#000" />
        <div className='usernamediv'>
          <div className="username">
            <span>{username}</span>
          </div>
          <div className="crown">
            {username === roomcreator && <FaCrown />}
            </div>
        </div>
      </div>
    </>
  );
}

export default Client;
