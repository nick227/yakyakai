import { Router } from 'express'
import { enqueueJob } from '../services/jobQueueService.js'
import { pauseJobSafe, resumeJobSafe, cancelJob } from '../services/jobStateService.js'
import { requireAuth } from '../middleware/auth.js'
import { assertOwnsJob } from '../middleware/permissions.js'
import { route } from '../lib/route.js'
import { requireId, requireString, optionalString } from '../lib/validation.js'

export const jobRoutes = Router()

jobRoutes.post('/start', requireAuth, route(async (req, res) => {
  const prompt = requireString(req.body?.prompt, 'prompt', { max: 24_000 })
  const sessionId = optionalString(req.body?.sessionId, 'sessionId', { max: 128, fallback: null }) || null

  const job = await enqueueJob({
    userId: req.user.id,
    sessionId,
    type: 'run.session',
    payload: { prompt },
  })

  res.status(201).json({ ok: true, job })
}))

jobRoutes.post('/:id/pause', requireAuth, route(async (req, res) => {
  const id = requireId(req.params.id)
  await assertOwnsJob(req.user.id, id)
  const job = await pauseJobSafe(id, req.user.id)
  res.json({ ok: true, job })
}))

jobRoutes.post('/:id/resume', requireAuth, route(async (req, res) => {
  const id = requireId(req.params.id)
  await assertOwnsJob(req.user.id, id)
  const job = await resumeJobSafe(id, req.user.id)
  res.json({ ok: true, job })
}))

jobRoutes.post('/:id/cancel', requireAuth, route(async (req, res) => {
  const id = requireId(req.params.id)
  await assertOwnsJob(req.user.id, id)
  const job = await cancelJob(id, req.user.id)
  res.json({ ok: true, job })
}))
