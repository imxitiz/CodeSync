import randomColor from "randomcolor";
import { useRef } from "react";
import Avatar from "react-avatar";
import { FaCrown } from "react-icons/fa";

function Client({ username, roomcreator }) {
  const colorRef = useRef(randomColor());
  return (
    <div className="client">
      <Avatar
        color={colorRef.current}
        fgColor="#000"
        name={username}
        round="14px"
        size={50}
      />
      <div className="usernamediv">
        <div className="username">
          <span>{username}</span>
        </div>
        <div className="crown">{username === roomcreator && <FaCrown />}</div>
      </div>
    </div>
  );
}

export default Client;
