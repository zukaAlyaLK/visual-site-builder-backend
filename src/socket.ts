import { Server, Socket } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import * as Y from 'yjs';
import { prisma } from './prisma';
import { RoomParticipant } from './types';

// In-memory registry of active participants: roomName -> RoomParticipant[]
const roomParticipants = new Map<string, RoomParticipant[]>();

// In-memory Yjs documents per room (for relay + sync to new joiners)
const roomDocs = new Map<string, Y.Doc>();

// Debounce timers for DB persistence per room
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

function getOrCreateDoc(roomName: string): Y.Doc {
  if (!roomDocs.has(roomName)) {
    roomDocs.set(roomName, new Y.Doc());
  }
  return roomDocs.get(roomName)!;
}

function getRandomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/**
 * Schedule a debounced save of the room's Yjs document to the database.
 * Saves the yElements array as canvasData.elements.
 */
function scheduleSave(roomName: string, projectId: string) {
  const existing = saveTimers.get(roomName);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    saveTimers.delete(roomName);
    const doc = roomDocs.get(roomName);
    if (!doc) return;

    try {
      const yElements = doc.getArray<any>('elements');
      const elements = yElements.toArray();

      // Find the project owner to perform the save
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { ownerId: true },
      });
      if (!project) return;

      await prisma.project.update({
        where: { id: projectId },
        data: { canvasData: { elements } },
      });
      console.log(`💾 Auto-saved canvas for project ${projectId} (${elements.length} elements)`);
    } catch (err: any) {
      console.error(`Failed to auto-save project ${projectId}:`, err.message);
    }
  }, 3000); // 3-second debounce

  saveTimers.set(roomName, timer);
}

export function initSocket(server: http.Server): Server {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true,
    },
  });

  // JWT Authentication Middleware for Socket.io
  // The token MUST be passed as socket.handshake.auth.token
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: Token is required'));
      }

      // Strip "Bearer " prefix if present
      const cleanToken = typeof token === 'string' && token.startsWith('Bearer ')
        ? token.slice(7)
        : token as string;

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

    // Fetch user details from database
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

    // Store joined rooms for cleanup on disconnect
    const joinedRooms = new Set<string>();

    // ─── 1. Join Project Room ────────────────────────────────────────────────
    socket.on('join-project', async ({ projectId }: { projectId: string }) => {
      try {
        if (!projectId) {
          socket.emit('error', { message: 'projectId is required' });
          return;
        }

        // Verify the user has access to the project
        const memberAccess = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId, userId } },
        });

        if (!memberAccess) {
          socket.emit('error', { message: 'Access denied: You are not a member of this project' });
          return;
        }

        const roomName = `project:${projectId}`;
        socket.join(roomName);
        joinedRooms.add(roomName);

        // ── Participants ──────────────────────────────────────────────────────
        if (!roomParticipants.has(roomName)) {
          roomParticipants.set(roomName, []);
        }
        const participants = roomParticipants.get(roomName)!;

        const existingIndex = participants.findIndex(p => p.socketId === socket.id);
        if (existingIndex === -1) {
          const newParticipant: RoomParticipant = {
            socketId: socket.id,
            userId: user.id,
            userName: user.name,
            color: getRandomColor(),
          };
          participants.push(newParticipant);
          socket.data.color = newParticipant.color;
        }

        // Broadcast updated participant list to everyone in the room
        io.to(roomName).emit('room-participants', participants);

        // ── Yjs State Sync ────────────────────────────────────────────────────
        const doc = getOrCreateDoc(roomName);

        // If the server's in-memory doc is empty, seed it from the DB before
        // sending state to the client. This means the SERVER is always the
        // source of truth — clients never need to push DB data into Yjs.
        const yElements = doc.getArray<any>('elements');
        if (yElements.length === 0) {
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { canvasData: true },
          });
          const savedElements: any[] = (project?.canvasData as any)?.elements ?? [];
          if (savedElements.length > 0) {
            doc.transact(() => {
              yElements.delete(0, yElements.length);
              yElements.push(savedElements);
            });
            console.log(`📥 Seeded room ${roomName} from DB (${savedElements.length} elements)`);
          }
        }

        // Always send current doc state to the newly joined client.
        // Even if the doc was just empty-seeded, we send so the client knows
        // the server is authoritative and should NOT seed from its own DB copy.
        const stateUpdate = Y.encodeStateAsUpdate(doc);
        socket.emit('sync-state', Array.from(stateUpdate));

        console.log(`👥 User ${user.name} joined room ${roomName}`);
      } catch (err: any) {
        console.error(`Error joining room: ${err.message}`);
        socket.emit('error', { message: 'Failed to join project room' });
      }
    });

    // ─── 2. Leave Project Room ───────────────────────────────────────────────
    socket.on('leave-project', ({ projectId }: { projectId: string }) => {
      const roomName = `project:${projectId}`;
      socket.leave(roomName);
      joinedRooms.delete(roomName);

      const participants = roomParticipants.get(roomName);
      if (participants) {
        const updated = participants.filter(p => p.socketId !== socket.id);
        roomParticipants.set(roomName, updated);
        io.to(roomName).emit('room-participants', updated);
      }

      // Clean up empty room doc to free memory
      if (!io.sockets.adapter.rooms.has(roomName)) {
        roomDocs.delete(roomName);
        roomParticipants.delete(roomName);
      }

      console.log(`🚪 User ${user.name} left room ${roomName}`);
    });

    // ─── 3. Yjs Update Relay ─────────────────────────────────────────────────
    // Receives a Yjs binary update from a client, merges it into the room doc,
    // and broadcasts to all other clients in the room.
    socket.on('yjs-update', ({ projectId, update }: { projectId: string; update: number[] }) => {
      const roomName = `project:${projectId}`;
      if (!socket.rooms.has(roomName)) return;

      try {
        const updateBytes = new Uint8Array(update);
        const doc = getOrCreateDoc(roomName);

        // Apply update to the server-side doc (so new joiners get full state)
        Y.applyUpdate(doc, updateBytes, 'server');

        // Relay to all other clients in the room
        socket.to(roomName).emit('yjs-update', { update });

        // Schedule debounced DB persistence
        scheduleSave(roomName, projectId);
      } catch (err: any) {
        console.error(`Yjs update error in room ${roomName}:`, err.message);
      }
    });

    // ─── 4. Cursor Movement Relay ────────────────────────────────────────────
    socket.on('cursor-move', ({ projectId, x, y }: { projectId: string; x: number; y: number }) => {
      const roomName = `project:${projectId}`;
      if (!socket.rooms.has(roomName)) return;

      socket.to(roomName).emit('cursor-moved', {
        socketId: socket.id,
        userId: user.id,
        userName: user.name,
        color: socket.data.color,
        x,
        y,
      });
    });

    // ─── 5. Disconnect ───────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 User disconnected: ${user.name} - Socket ID: ${socket.id}`);

      for (const roomName of joinedRooms) {
        const participants = roomParticipants.get(roomName);
        if (participants) {
          const updated = participants.filter(p => p.socketId !== socket.id);
          roomParticipants.set(roomName, updated);
          io.to(roomName).emit('room-participants', updated);
        }

        // Clean up empty room doc
        if (!io.sockets.adapter.rooms.has(roomName)) {
          roomDocs.delete(roomName);
          roomParticipants.delete(roomName);
        }
      }

      joinedRooms.clear();
    });
  });

  return io;
}
