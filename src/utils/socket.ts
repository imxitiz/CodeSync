import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { getBackendUrl } from "./constants";

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

  return io(getBackendUrl(), options);
};
