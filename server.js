import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ACTIONS } from './action.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server);
app.use(
  cors({
    origin: 'http://localhost:5137',
    credentials: true,
  })
);

app.use(express.static('dist'));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const userSocketMap = new Map();

const getAllconnectedClients = (roomId) => {
  return [...io.sockets.adapter.rooms.get(roomId)].map((socketId) => {
    return {
      socketId,
      username: userSocketMap.get(socketId),
    };
  });
};

io.on('connection', (socket) => {
  socket.on(ACTIONS.JOIN, ({ roomId, userName }) => {
    userSocketMap.set(socket.id, userName);

    socket.join(roomId);

    const clients = getAllconnectedClients(roomId);
    if (
        clients.length > 1 &&
        clients.filter((client) => client.username === userName).length > 1
    ) {
      userSocketMap.delete(socket.id);
      socket.leave(roomId);
      socket.disconnect();
      socket.emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userName,
      });
      return;
    }
    
    // Broadcast editable state to all clients in the room
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username: userName,
        socketId: socket.id,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, currenteditor }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code, currenteditor });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code, currenteditor }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code, currenteditor: currenteditor, });
  });

  socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ roomId, currenteditor }) => {
      socket.in(roomId).emit(ACTIONS.SET_CURRENT_EDITOR, { currenteditor });
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap.get(socket.id),
      });
    });
    userSocketMap.delete(socket.id);
    socket.leave();
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
