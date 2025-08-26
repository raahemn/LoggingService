import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import httpStatus from 'http-status'
import mongoSanitize from 'express-mongo-sanitize'
import { successHandler } from './config/morgan'
import ApiError from './utils/ApiError'
import { errorConverter, errorHandler as errorMiddleware } from './middlewares/error'
import routes from './routes'
import logger from './config/logger'

const app = express()

// Create error logger for app-level issues
const appErrorLogger = logger.withTraceId('APP_ERROR')

app.use(successHandler)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(mongoSanitize())
// app.use(cors())    //disable these when connecting via the API Gateway

app.use('/LoggingService', routes)

// Handle 404
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'))
})

// Error handlers
app.use(errorConverter)
app.use(errorMiddleware)

// Final error handler for anything that slips through
app.use((err: Error, req: Request, res: Response) => {
  appErrorLogger.error(`💥 UNHANDLED EXPRESS ERROR: ${err.message} on ${req.method} ${req.originalUrl}`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString()
  })
  
  // Send generic error response if headers haven't been sent
  if (!res.headersSent) {
    res.status(500).json({
      code: 500,
      message: 'Internal Server Error',
      timestamp: new Date().toISOString()
    })
  }
})

export default app
