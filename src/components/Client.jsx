import Avatar from 'react-avatar';
import randomColor from 'randomcolor';
import { useRef } from 'react';

function Client({ username }) {
  console.log(username);
  const colorRef = useRef(randomColor());
  return (
    <>
      <div className="client">
        <Avatar name={username} size={50} round="14px" color={colorRef.current} fgColor="#000" />
        <span className="username">{username}</span>
      </div>
    </>
  );
}

export default Client;
