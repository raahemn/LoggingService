import { Server } from 'socket.io'
import http from 'http'
import logger from './config/logger'
import jwt from 'jsonwebtoken'
import config from './config/config';
import { UserPayload } from "./middlewares/auth";



let io: Server

export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: '*', // tighten later for production
      methods: ['GET', 'POST'],
      credentials: true
    }
  })

   // Auth middleware
  io.use((socket, next) => {
    try {
      const authHeader = socket.handshake.headers.authorization as string | undefined;
      if (!authHeader) return next(new Error("Access token required"));

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, config.jwtSecret) as UserPayload;

      // Attach user info to socket
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`)

    socket.on('register', (userId: string) => {
      logger.info(`User ${userId} registered on socket ${socket.id}`)
      socket.data.userId = userId // store user on socket
    })

    socket.on('ping', () => {
      socket.emit('pong', { now: new Date().toISOString() })
    })

    socket.on('disconnect', () => {
      logger.info(`❌ Client disconnected: ${socket.id}`)
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized!')
  return io
}
