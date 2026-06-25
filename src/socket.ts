import { Server, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import { RoomParticipant } from './types';

// In-memory registry of active participants: roomName (e.g. project:projectId) -> RoomParticipant[]
const roomParticipants = new Map<string, RoomParticipant[]>();

// A preset color palette for room participants
const COLORS = [
  '#FF5733', // Coral
  '#33FF57', // Lime Green
  '#3357FF', // Blue
  '#F3FF33', // Yellow
  '#FF33F3', // Pink
  '#33FFF3', // Cyan
  '#FFAF33', // Orange
  '#AF33FF', // Purple
  '#FF3333', // Red
  '#33FFAF', // Mint
];

function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function initSocket(server: http.Server): Server {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
  });

  // JWT Authentication Middleware for Socket.io
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication error: Token is required'));
      }

      // If token has Bearer prefix, clean it
      const cleanToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
      if (!cleanToken) {
        return next(new Error('Authentication error: Invalid Token format'));
      }

      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET!) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const userId = socket.data.userId;

    // Fetch user details from database to get their name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      socket.disconnect();
      return;
    }

    socket.data.userName = user.name;
    console.log(`🔌 User connected: ${user.name} (${user.email}) - Socket ID: ${socket.id}`);

    // Store joined rooms for this socket to clean up on disconnect
    const joinedRooms = new Set<string>();

    // 1. Join Project Room
    socket.on('join-project', async ({ projectId }: { projectId: string }) => {
      try {
        if (!projectId) {
          socket.emit('error', { message: 'projectId is required' });
          return;
        }

        // Verify that the user has access to the project
        const memberAccess = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: { projectId, userId },
          },
        });

        if (!memberAccess) {
          socket.emit('error', { message: 'Access denied: You are not a member of this project' });
          return;
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);
        joinedRooms.add(roomName);

        // Add to active participants list
        if (!roomParticipants.has(roomName)) {
          roomParticipants.set(roomName, []);
        }

        const participants = roomParticipants.get(roomName)!;
        
        // Avoid duplicate entries for the same socket/user in this room
        const existingParticipantIndex = participants.findIndex(p => p.socketId === socket.id);
        
        if (existingParticipantIndex === -1) {
          const newParticipant: RoomParticipant = {
            socketId: socket.id,
            userId: user.id,
            userName: user.name,
            color: getRandomColor(),
          };
          participants.push(newParticipant);
          socket.data.color = newParticipant.color; // store color on socket object
        }

        // Broadcast updated list to everyone in the room
        io.to(roomName).emit('room-participants', participants);
        
        console.log(`👥 User ${user.name} joined room ${roomName}`);
      } catch (err: any) {
        console.error(`Error joining room: ${err.message}`);
        socket.emit('error', { message: 'Failed to join project room' });
      }
    });

    // 2. Leave Project Room
    socket.on('leave-project', ({ projectId }: { projectId: string }) => {
      const roomName = `project:${projectId}`;
      socket.leave(roomName);
      joinedRooms.delete(roomName);

      const participants = roomParticipants.get(roomName);
      if (participants) {
        const updatedParticipants = participants.filter(p => p.socketId !== socket.id);
        roomParticipants.set(roomName, updatedParticipants);
        io.to(roomName).emit('room-participants', updatedParticipants);
      }
      console.log(`🚪 User ${user.name} left room ${roomName}`);
    });

    // 3. Sync Cursor Movements
    socket.on('cursor-move', ({ projectId, x, y }: { projectId: string; x: number; y: number }) => {
      const roomName = `project:${projectId}`;
      if (socket.rooms.has(roomName)) {
        socket.to(roomName).emit('cursor-moved', {
          userId: user.id,
          userName: user.name,
          color: socket.data.color,
          x,
          y,
        });
      }
    });

    // 4. Live Canvas Updates
    socket.on('canvas-update', ({ projectId, canvasData }: { projectId: string; canvasData: any }) => {
      const roomName = `project:${projectId}`;
      if (socket.rooms.has(roomName)) {
        // Broadcast the update to all other collaborators in the room
        socket.to(roomName).emit('canvas-updated', {
          canvasData,
          updatedBy: user.id,
        });
      }
    });

    // 5. Handle Disconnect
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${user.name} - Socket ID: ${socket.id}`);
      
      for (const roomName of joinedRooms) {
        const participants = roomParticipants.get(roomName);
        if (participants) {
          const updatedParticipants = participants.filter(p => p.socketId !== socket.id);
          roomParticipants.set(roomName, updatedParticipants);
          
          // Broadcast to remaining users
          io.to(roomName).emit('room-participants', updatedParticipants);
        }
      }
      joinedRooms.clear();
    });
  });

  return io;
}
