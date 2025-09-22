import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { BACKEND_API_URL } from "./constants";

export const initSocket = (): Socket => {
  const options: {
    "force new connection": boolean;
    reconnectionAttempts: number;
    timeout: number;
    transports: string[];
  } = {
    "force new connection": true,
    reconnectionAttempts: Number.POSITIVE_INFINITY,
    timeout: 10_000,
    transports: ["websocket"],
  };

  return io(BACKEND_API_URL, options);
};