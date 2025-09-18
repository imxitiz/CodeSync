import { io } from 'socket.io-client';

export const initSocket = async () => {
  const options = {
    'force new connection': true,
    reconnectionAttempts: 'Infinity',
    timeout: 10000,
    transports: ['websocket'],
  };
  // RENDER_EXTERNAL_URL	The Render URL for a web service or static site; of the form https://foobar.onrender.com. Empty for all other service types.
  // RENDER_EXTERNAL_HOSTNAME	The Render host for a web service or static site. Of the form foobar.onrender.com. Empty for all other service types.
  console.log('process.env.VITE_BACKEND_API_URL', process.env.VITE_BACKEND_API_URL);
  const backendApiUrl = process.env.VITE_BACKEND_API_URL || 'http://localhost:3000';
  return io(backendApiUrl, options);
};
