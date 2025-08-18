import express, { Router, Request, Response } from 'express'
import createResponse from '../utils/responseHelper'
import authRoute from './authRoutes' 
import applicationRoute from './applicationRoutes'
import logRoutes from './logRoutes'
import userGroupsRoute from './userGroups'
import userRoute from './userRoutes'
import analyticsRoute from './analyticsRoutes'
import settingsRoute from './settingsRoutes' 
import alertRoute from './alertRoutes'
import chatbotRoute from './chatbotRoutes'
import starredMessagesRoute from './starredMessages'

const router: Router = express.Router()

const defaultRoutes: { path: string; route: Router }[] = [
  { path: '/user', route: userRoute },
  { path: '/auth', route: authRoute },
  { path: '/application', route: applicationRoute },
  { path: '/user-groups', route: userGroupsRoute },
  { path: '/logs', route: logRoutes },
  { path: '/analytics', route: analyticsRoute },
  { path: '/settings', route: settingsRoute},
  { path: '/alerts', route: alertRoute},
  { path: '/chatbot', route: chatbotRoute},
  { path: '/starred-messages', route: starredMessagesRoute},
]

defaultRoutes.forEach(({ path, route }) => {
  router.use(path, route)
})

// Health check route
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json(createResponse(200, 'Server is healthy', { timestamp: new Date().toISOString() }))
})

export default router
