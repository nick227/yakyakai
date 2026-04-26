import { Router } from 'express'
import { recoverStuckJobs } from '../services/recoveryService.js'
import { requireAdmin } from '../middleware/permissions.js'
import { route } from '../lib/route.js'
import { optionalInt } from '../lib/validation.js'

export const recoveryRoutes = Router()

recoveryRoutes.post('/stuck-jobs', requireAdmin, route(async (req, res) => {
  const olderThanMinutes = optionalInt(req.body?.olderThanMinutes, 'olderThanMinutes', {
    min: 2,
    max: 1440,
    fallback: 10,
  })

  const result = await recoverStuckJobs({ olderThanMinutes })
  res.json({ ok: true, ...result })
}))
