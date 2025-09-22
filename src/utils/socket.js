import { io } from "socket.io-client";
import { BACKEND_API_URL } from "./constant";

export const initSocket = () => {
  const options = {
    "force new connection": true,
    reconnectionAttempts: "Infinity",
    timeout: 10_000,
    transports: ["websocket"],
  };

  return io(BACKEND_API_URL, options);
};
