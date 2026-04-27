import { Router } from 'express'
import { getLatestMemory, saveCompressedMemory } from '../services/memoryCompressionService.js'
import { requireAuth } from '../middleware/auth.js'
import { assertOwnsSession } from '../middleware/permissions.js'
import { route } from '../lib/route.js'
import { requireId, optionalArray } from '../lib/validation.js'

export const memoryRoutes = Router()

/**
 * @swagger
 * /api/memory/{sessionId}/compress:
 *   post:
 *     summary: Compress and save session memory
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 maxItems: 500
 *     responses:
 *       200:
 *         description: Memory compressed and saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 memory:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
memoryRoutes.post('/:sessionId/compress', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  const messages = optionalArray(req.body?.messages, 'messages', { max: 500 })
  const memory = await saveCompressedMemory({ sessionId, messages })
  res.json({ ok: true, memory })
}))

/**
 * @swagger
 * /api/memory/{sessionId}/latest:
 *   get:
 *     summary: Get latest compressed session memory
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Latest memory retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 memory:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
memoryRoutes.get('/:sessionId/latest', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  const memory = await getLatestMemory(sessionId)
  res.json({ ok: true, memory })
}))
