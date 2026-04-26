import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getUserDashboardStats } from '../services/analyticsService.js'
import { route } from '../lib/route.js'

export const dashboardRoutes = Router()

dashboardRoutes.get('/me', requireAuth, route(async (req, res) => {
  const dashboard = await getUserDashboardStats(req.user.id)
  res.json({ ok: true, dashboard })
}))
