import { Server } from 'socket.io'
import http from 'http'
import logger from './config/logger'
import jwt from 'jsonwebtoken'
import config from './config/config'
import { UserPayload } from './middlewares/auth'

let io: Server

export function initSocket(server: http.Server) {
  io = new Server(server, {
    cors: {
      origin: '*', // restrict later
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/api/socket.io'
  })

  // Auth middleware
  io.use((socket, next) => {
    console.log('🔒 Authenticating socket connection...')
    try {
      console.log('Socket handshake headers:', socket.handshake)
      const authHeader = socket.handshake.auth?.token as string | undefined
      if (!authHeader) return next(new Error('Access token required'))

      const token = authHeader.split(' ')[1]
      const decoded = jwt.verify(token, config.jwtSecret) as UserPayload

      // Attach user info to socket
      ;(socket as any).user = decoded
      next()
    } catch (err) {
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', (socket) => {
    logger.info(`🔌 Client connected: ${socket.id}`)

    socket.on('register', (userId: string) => {
      logger.info(`User ${userId} registered on socket ${socket.id}`)
      socket.data.userId = userId // store user on socket
    })

    socket.emit('test', { message: 'test message' })

    const alert = {
      _id: '66b9a1f3c72d1a99c13a',
      appId: 'app-123',
      errorCount: 15,
      threshold: 10,
      period: 5,
      timestamp: new Date(),
      resolved: false,
      __v: 0,
      applicationName: 'Payments Service'
    }

    setInterval(() => {
      // emit to all connected clients
      // console.log('Emitting test alert to all clients')
      io.emit('socketNotification', alert)
    }, 5000)

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
