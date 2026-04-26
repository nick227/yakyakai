import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { assertOwnsSession } from '../middleware/permissions.js'
import { saveOutput, toJsonExport, toMarkdown } from '../services/exportService.js'
import { route } from '../lib/route.js'
import { optionalArray, optionalString } from '../lib/validation.js'

export const exportRoutes = Router()

exportRoutes.post('/markdown', requireAuth, route(async (req, res) => {
  const title = optionalString(req.body?.title, 'title', { max: 160, fallback: 'Yakyakai Export' })
  const sessionId = optionalString(req.body?.sessionId, 'sessionId', { max: 128, fallback: null }) || null
  if (sessionId) await assertOwnsSession(req.user.id, sessionId)

  const messages = optionalArray(req.body?.messages, 'messages', { max: 500 })
  const body = toMarkdown({ title, messages })

  const saved = await saveOutput({
    userId: req.user.id,
    sessionId,
    title,
    body,
    format: 'markdown',
  })

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('X-Saved-Output-Id', saved.id)
  res.send(body)
}))

exportRoutes.post('/json', requireAuth, route(async (req, res) => {
  const sessionId = optionalString(req.body?.sessionId, 'sessionId', { max: 128, fallback: null }) || null
  if (sessionId) await assertOwnsSession(req.user.id, sessionId)

  const title = optionalString(req.body?.title, 'title', { max: 160, fallback: 'Yakyakai JSON Export' })
  const messages = optionalArray(req.body?.messages, 'messages', { max: 500 })

  const payload = { title, sessionId, messages }
  const body = toJsonExport(payload)

  const saved = await saveOutput({
    userId: req.user.id,
    sessionId,
    title,
    body,
    format: 'json',
  })

  res.json({ ok: true, saved, body: payload })
}))
