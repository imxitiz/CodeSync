import { io } from 'socket.io-client';
import { BACKEND_API_URL } from './constant';

export const initSocket = async () => {
  const options = {
    'force new connection': true,
    reconnectionAttempts: 'Infinity',
    timeout: 10000,
    transports: ['websocket'],
  };

  return io(BACKEND_API_URL, options);
};
