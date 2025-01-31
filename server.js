import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ACTIONS } from './action.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

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
const roomCreatorMap = new Map();
const roomCodeMap = new Map();
const roomIntervalMap = new Map();

const getAllconnectedClients = (roomId) => {
  return [...(io.sockets.adapter.rooms.get(roomId) || [])].map((socketId) => {
    return {
      socketId,
      username: userSocketMap.get(socketId),
    };
  });
};

async function createOrUpdateRoomCode(roomId, code) {
  try {
    await prisma.code.upsert({
      where: { roomId },
      update: { content: code },
      create: { roomId, content: code },
    });
  } catch (error) {
    console.error('Error creating or updating room code:', error);
  }
}

async function getCodeFromDatabase(roomId) {
  try {
    const roomData = await prisma.code.findUnique({ where: { roomId } });
    return roomData?.content || '';
  } catch (error) {
    console.error('Error retrieving code from database:', error);
    return '';
  }
}

io.on('connection', (socket) => {
  socket.on(ACTIONS.JOIN, async ({ roomId, userName }) => {
    userName = userName.trim();
    roomId = roomId.trim();
    userSocketMap.set(socket.id, userName);
    socket.join(roomId);
    let roomCreator = null;
    let initialCode = '';
    let roomCodeId;
    try {
      if (!roomCreatorMap.has(roomId)) {
        console.log("Chalyo admin ho");
        roomCreatorMap.set(roomId, userName);
        roomCreator = userName;
        if (await prisma.code.findUnique({ where: { roomId } })) {
          roomCodeId = roomId;
          const Getcode = await getCodeFromDatabase(roomId);
          roomCodeMap.set(roomId, Getcode);
          initialCode = Getcode;
        } else {
          roomCodeId = uuidv4();
          roomCodeMap.set(roomId, "");
          initialCode = "";
        }
        await createOrUpdateRoomCode(roomCodeId, initialCode);
        // Save code content to database every 2 minutes
        const intervalId = setInterval(async () => {
          const code = roomCodeMap.get(roomId) || "";
          await createOrUpdateRoomCode(roomCodeId, code);
        }, 10000); // 120000 ms = 2 minutes

        roomIntervalMap.set(roomId, intervalId);
      } else {
        console.log("haina ma admin");
        roomCreator = roomCreatorMap.get(roomId);
        if (roomCreator == userName) {
          console.log("'Chalyo admin ho");
          roomCodeId = roomId;
          const Getcode = await getCodeFromDatabase(roomId);
          roomCodeMap.set(roomId, Getcode);
          initialCode = Getcode;
        }
      }
    } catch (error) {
      console.error("Error during JOIN:", error);
      return socket.emit(ACTIONS.ERROR, {
        message: "Error during join process.",
      });
    }

    const clients = getAllconnectedClients(roomId);
    if (
      clients.length > 1 &&
      clients.filter((client) => client.username === userName).length > 1
    ) {
      userSocketMap.delete(socket.id);
      socket.emit(ACTIONS.DUPLICATE_USER, {
        username: userName,
      });
      socket.leave(roomId);
      socket.disconnect();
      return;
    }

    // Broadcast editable state to all clients in the room
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username: userName,
        socketId: socket.id,
        roomcreator: roomCreator,
        code: initialCode && initialCode,
        roomCodeId: roomCreator === userName ? roomCodeId : null,
      });
    });
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, currenteditor }) => {
    roomCodeMap.set(roomId, code); // Store the current code in memory
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code, currenteditor });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code, currenteditor }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code, currenteditor });
  });

  socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ roomId, currenteditor }) => {
    socket.in(roomId).emit(ACTIONS.SET_CURRENT_EDITOR, { currenteditor });
  });

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap.get(socket.id),
      });

      // Check if the room is empty after the user leaves
      setTimeout(() => {
        if (io.sockets.adapter.rooms.get(roomId) === undefined) {
          roomCreatorMap.delete(roomId);
          roomCodeMap.delete(roomId); // Clear code from memory when room is empty

          // Clear the interval for the room
          const intervalId = roomIntervalMap.get(roomId);
          if (intervalId) {
            clearInterval(intervalId);
            roomIntervalMap.delete(roomId);
          }
        }
      }, 500);
    });
    userSocketMap.delete(socket.id);
    socket.leave();
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
