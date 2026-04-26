import { Router } from 'express'
import { getLatestMemory, saveCompressedMemory } from '../services/memoryCompressionService.js'
import { requireAuth } from '../middleware/auth.js'
import { assertOwnsSession } from '../middleware/permissions.js'
import { route } from '../lib/route.js'
import { requireId, optionalArray } from '../lib/validation.js'

export const memoryRoutes = Router()

memoryRoutes.post('/:sessionId/compress', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  const messages = optionalArray(req.body?.messages, 'messages', { max: 500 })
  const memory = await saveCompressedMemory({ sessionId, messages })
  res.json({ ok: true, memory })
}))

memoryRoutes.get('/:sessionId/latest', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  const memory = await getLatestMemory(sessionId)
  res.json({ ok: true, memory })
}))
