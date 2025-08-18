import http from 'http'
import mongoose from 'mongoose'
import app from './app'
import config from './config/config'
import { googleDirectoryService } from './services/googleDirectoryService'
import { startAgenda } from './config/agenda';
import { monitoringService } from './services/monitoringService'
import { logRetentionService } from './services/dataRetentionService'
import { initializeChatbot, closeChatbot } from './controllers/chatbotController'
import logger from './config/logger'

// Debug loggers for different components
const startupDebugger = logger.withTraceId('STARTUP')
const dbDebugger = logger.withTraceId('DATABASE')
const serviceDebugger = logger.withTraceId('SERVICE')
const errorDebugger = logger.withTraceId('GLOBAL_ERROR')

// Global error handlers for truly critical issues
process.on('uncaughtException', (error: Error) => {
  errorDebugger.error('💥 CRITICAL: Uncaught Exception - Application will exit', {
    error: error.message,
    stack: error.stack,
    pid: process.pid,
    timestamp: new Date().toISOString()
  })
  
  // Give the logger time to write the log before exiting
  setTimeout(() => {
    process.exit(1)
  }, 1000)
})

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  errorDebugger.error('CRITICAL: Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : 'No stack available',
    promise: promise.toString(),
    pid: process.pid,
    timestamp: new Date().toISOString()
  })
  
  errorDebugger.warn('Application continuing after unhandled rejection - monitor for stability issues')
})

process.on('warning', (warning: Error) => {
  const warningDetails = `Node.js Warning: ${warning.name} - ${warning.message} | Stack: ${warning.stack || 'No stack'} | PID: ${process.pid}`
  errorDebugger.warn(warningDetails)
})

const server = http.createServer(app)

const PORT = config.port

mongoose
  .connect(config.mongoose)
  .then(async () => {
    dbDebugger.info('Connected to Database')

    await logRetentionService.initializeLogRetention();
    await startAgenda();

    monitoringService.start();
    serviceDebugger.info('✅ Monitoring service started');

    // Initialize chatbot service
    startupDebugger.info('Initializing Chatbot service...')
    try {
      await initializeChatbot();
      serviceDebugger.info('✅ Chatbot service initialized successfully')
    } catch (error) {
      serviceDebugger.error('❌ Chatbot service initialization failed:', error)
    }

    startupDebugger.info('Initializing Google Directory service...')
    googleDirectoryService
      .testConnection()
      .then((result) => {
        if (result.success) {
          serviceDebugger.info('✅ Google Directory service initialized successfully')
        } else {
          serviceDebugger.warn(`⚠️ Google Directory service initialization failed: ${result.message}`)
        }
      })
      .catch((error) => {
        serviceDebugger.error('❌ Google Directory service test failed:', error)
      })

    server.listen(PORT, () => {
      startupDebugger.info(`Server is listening on port ${PORT}`)
    })
  })
  .catch((error) => {
    dbDebugger.error('Database connection failed:', error)
  })

// Graceful shutdown
process.on('SIGTERM', async () => {
  startupDebugger.info('SIGTERM received, shutting down gracefully...')
  await closeChatbot()
  process.exit(0)
})

process.on('SIGINT', async () => {
  startupDebugger.info('SIGINT received, shutting down gracefully...')
  await closeChatbot()
  process.exit(0)
})