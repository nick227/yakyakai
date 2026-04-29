import { Router } from 'express'
import { prisma } from '../db/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { assertOwnsSession } from '../middleware/permissions.js'
import { enqueueJob } from '../services/jobQueueService.js'
import { route } from '../lib/route.js'
import { requireString, requireId, optionalInt, optionalString } from '../lib/validation.js'
import { forbidden } from '../lib/httpError.js'
import { EventTypes } from '../lib/eventTypes.js'
import { VALID_PACES } from '../lib/pace.js'
import { logger } from '../lib/logger.js'
import { publish } from '../worker/events.js'
import { abortSessionAiCall } from '../services/sessionAbortService.js'

export const sessionRoutes = Router()

// Track active SSE connections per user
const activeSseConnections = new Map()
const MAX_SSE_CONNECTIONS_PER_USER = 5

async function hasActiveCycleJob(sessionId) {
  const activeJob = await prisma.job.findFirst({
    where: {
      sessionId,
      type: { in: ['session.start', 'session.cycle'] },
      status: { in: ['queued', 'running'] },
    },
    select: { id: true },
  })
  return Boolean(activeJob)
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: List user sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session list retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 sessions:
 *                   type: array
 *                 nextCursor:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
sessionRoutes.get('/', requireAuth, route(async (req, res) => {
  const take = optionalInt(req.query?.take, 'take', { min: 1, max: 50, fallback: 20 })
  const cursor = optionalString(req.query?.cursor, 'cursor', { max: 64, fallback: null })
  const sessions = await prisma.aiSession.findMany({
    where: { userId: req.user.id },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    select: { id: true, title: true, status: true, createdAt: true, cycleCount: true, promptCount: true },
  })
  const hasMore = sessions.length > take
  const items = hasMore ? sessions.slice(0, take) : sessions
  const nextCursor = hasMore ? items[items.length - 1].id : null
  res.json({ ok: true, sessions: items, nextCursor })
}))

// ── Start ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/start:
 *   post:
 *     summary: Create a new AI session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *                 maxLength: 24000
 *               pace:
 *                 type: string
 *                 enum: [steady, fast, thorough]
 *                 default: steady
 *               clientId:
 *                 type: string
 *                 maxLength: 80
 *     responses:
 *       201:
 *         description: Session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 sessionId:
 *                   type: string
 *                 jobId:
 *                   type: string
 *                 status:
 *                   type: string
 *                 pace:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
sessionRoutes.post('/start', requireAuth, route(async (req, res) => {
  const originalPrompt = requireString(req.body?.prompt, 'prompt', { max: 24_000 })
  const pace = VALID_PACES.includes(req.body?.pace) ? req.body.pace : 'steady'
  const clientId = optionalString(req.body?.clientId, 'clientId', { max: 80, fallback: null })

  logger.info('Session start', { userId: req.user.id, pace, promptLength: originalPrompt.length })

  const session = await prisma.aiSession.create({
    data: {
      userId: req.user.id,
      title: originalPrompt.slice(0, 60),
      originalPrompt,
      status: 'queued',
      pace,
      isVisible: true,
      lastHeartbeatAt: new Date(),
      messages: {
        create: {
          role: 'USER',
          content: originalPrompt,
          ...(clientId ? { metadata: JSON.stringify({ clientId }) } : {}),
        },
      },
    },
  })

  logger.info('Session created', { sessionId: session.id, status: session.status })

  const job = await enqueueJob({
    userId: req.user.id,
    sessionId: session.id,
    type: 'session.start',
    payload: { prompt: originalPrompt },
  })

  logger.info('Job enqueued', { jobId: job.id, type: job.type, runAt: job.runAt })
  res.status(201).json({ ok: true, sessionId: session.id, jobId: job.id, status: 'queued', pace })
}))

// ── Get ───────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   get:
 *     summary: Get a specific session
 *     tags: [Sessions]
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
 *         description: Session retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 session:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
sessionRoutes.get('/:sessionId', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  const session = await prisma.aiSession.findFirst({
    where: { id: sessionId, userId: req.user.id },
  })
  if (!session) throw forbidden('SESSION_ACCESS_DENIED', 'You do not have access to this session.')
  res.json({ ok: true, session })
}))

// ── Rename ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   patch:
 *     summary: Rename a session
 *     tags: [Sessions]
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
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 120
 *     responses:
 *       200:
 *         description: Session renamed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 session:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
sessionRoutes.patch('/:sessionId', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  const title = optionalString(req.body?.title, 'title', { max: 120, fallback: null })
  if (title === null) return res.status(400).json({ ok: false, error: 'title required' })

  const session = await prisma.aiSession.findFirst({ where: { id: sessionId, userId: req.user.id } })
  if (!session) throw forbidden('SESSION_ACCESS_DENIED', 'You do not have access to this session.')

  const updated = await prisma.aiSession.update({
    where: { id: sessionId },
    data: { title: title.trim() },
    select: { id: true, title: true },
  })
  res.json({ ok: true, session: updated })
}))

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/{sessionId}:
 *   delete:
 *     summary: Delete a session
 *     tags: [Sessions]
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
 *         description: Session deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
sessionRoutes.delete('/:sessionId', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')

  const session = await prisma.aiSession.findFirst({ where: { id: sessionId, userId: req.user.id } })
  if (!session) throw forbidden('SESSION_ACCESS_DENIED', 'You do not have access to this session.')

  abortSessionAiCall(sessionId)
  await prisma.$transaction([
    prisma.job.deleteMany({ where: { sessionId } }),
    prisma.aiSession.delete({ where: { id: sessionId } }),
  ])
  res.json({ ok: true })
}))

// ── Messages (paginated) ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/{sessionId}/messages:
 *   get:
 *     summary: Get session messages (paginated)
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 messages:
 *                   type: array
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
sessionRoutes.get('/:sessionId/messages', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  const limit = Math.min(parseInt(req.query?.limit) || 50, 100)
  const before = req.query?.before ? new Date(req.query.before) : null

  const session = await prisma.aiSession.findFirst({
    where: { id: sessionId, userId: req.user.id },
  })
  if (!session) throw forbidden('SESSION_ACCESS_DENIED', 'You do not have access to this session.')

  const messages = await prisma.chatMessage.findMany({
    where: {
      sessionId,
      ...(before && { createdAt: { lt: before } }),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  res.json({ ok: true, messages: messages.reverse() })
}))

// ── SSE ───────────────────────────────────────────────────────────────────────

// Pre-serialized keepalive frame — avoids JSON.stringify + Date.now() every 10s
const SSE_KEEPALIVE = `data: ${JSON.stringify({ type: EventTypes.HEARTBEAT })}\n\n`

sessionRoutes.get('/:sessionId/events', requireAuth, async (req, res, next) => {
  try {
    const sessionId = requireId(req.params.sessionId, 'sessionId')
    const userId = req.user.id
    const requestedAfterEventId = optionalString(req.query?.afterEventId, 'afterEventId', { max: 64, fallback: null })
    
    // Check SSE connection limit
    const userConnections = activeSseConnections.get(userId) || 0
    if (userConnections >= MAX_SSE_CONNECTIONS_PER_USER) {
      logger.warn('SSE connection limit exceeded', { userId, currentConnections: userConnections })
      return res.status(429).json({ 
        ok: false, 
        error: 'TOO_MANY_CONNECTIONS',
        message: `Maximum ${MAX_SSE_CONNECTIONS_PER_USER} concurrent SSE connections allowed` 
      })
    }
    
    logger.info('SSE client connecting', { sessionId })
    
    const session = await prisma.aiSession.findUnique({
      where: { id: sessionId },
      select: { userId: true, status: true },
    })

    if (!session || session.userId !== req.user.id) return next(forbidden())

    logger.info('SSE session found', { sessionId, status: session.status, userIdMatch: session.userId === req.user.id })

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })

    // Track connection
    activeSseConnections.set(userId, userConnections + 1)

    const send = (event) => {
      logger.debug('SSE sending event', { type: event.type, sessionId })
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    send({ type: EventTypes.CONNECTED, payload: { sessionId, status: session.status } })

    const connectionTime = new Date()
    let afterEventId = requestedAfterEventId  // CUID cursor; null means "from connection time"

    // Poll database for new events
    const ssePollIntervalMs = Number(process.env.SSE_POLL_INTERVAL_MS || 500)
    const pollInterval = setInterval(async () => {
      try {
        const events = await prisma.aiSessionEvent.findMany({
          where: {
            sessionId,
            // Use id-cursor after first event to avoid missing same-millisecond events
            // (Windows MySQL clock resolution can be ~15ms, causing createdAt collisions)
            ...(afterEventId
              ? { id: { gt: afterEventId } }
              : { createdAt: { gte: connectionTime } }
            ),
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })

        for (const event of events) {
          try {
            const parsed = JSON.parse(event.payload)
            send({ ...parsed, eventId: event.id })
            afterEventId = event.id
          } catch (parseErr) {
            logger.error('SSE JSON parse error', { sessionId, eventId: event.id, error: parseErr.message })
          }
        }

        // Send keepalive if no new events
        if (events.length === 0) {
          res.write(SSE_KEEPALIVE)
        }
      } catch (err) {
        logger.error('SSE polling error', { sessionId, error: err.message })
      }
    }, ssePollIntervalMs)

    req.on('close', () => {
      logger.info('SSE client disconnected', { sessionId })
      clearInterval(pollInterval)
      // Decrement connection count
      const currentCount = activeSseConnections.get(userId) || 0
      activeSseConnections.set(userId, Math.max(0, currentCount - 1))
    })
  } catch (err) {
    logger.error('SSE endpoint error', { sessionId: req.params?.sessionId, error: err.message })
    if (res.headersSent) {
      res.end()
    } else {
      next(err)
    }
  }
})

// ── Heartbeat ─────────────────────────────────────────────────────────────────

sessionRoutes.post('/:sessionId/heartbeat', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  const visible = req.body?.visible !== false

  const result = await prisma.aiSession.updateMany({
    where: { id: sessionId, userId: req.user.id },
    data: { lastHeartbeatAt: new Date(), isVisible: visible },
  })

  if (result.count === 0) return res.sendStatus(403)
  res.sendStatus(204)
}))

// ── Pause ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/{sessionId}/pause:
 *   post:
 *     summary: Pause a running session
 *     tags: [Sessions]
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
 *         description: Session paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
sessionRoutes.post('/:sessionId/pause', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  await prisma.$transaction([
    prisma.job.updateMany({
      where: { sessionId, status: 'queued', type: { in: ['session.cycle', 'session.start'] } },
      data: { status: 'cancelled' },
    }),
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'paused', isVisible: false },
    }),
  ])
  abortSessionAiCall(sessionId)

  await publish(sessionId, EventTypes.STATUS, { status: 'paused' })
  res.json({ ok: true })
}))

// ── Resume ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/{sessionId}/resume:
 *   post:
 *     summary: Resume a paused session
 *     tags: [Sessions]
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
 *         description: Session resumed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
sessionRoutes.post('/:sessionId/resume', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  const session = await assertOwnsSession(req.user.id, sessionId)
  if (session.status === 'running') {
    return res.json({ ok: true, ignored: 'already_running' })
  }

  if (await hasActiveCycleJob(sessionId)) {
    return res.json({ ok: true, ignored: 'job_already_active' })
  }

  const resumePrompt = optionalString(req.body?.prompt, 'prompt', { max: 24_000, fallback: null })
  const clientId = optionalString(req.body?.clientId, 'clientId', { max: 80, fallback: null })
  const restartPrompt = resumePrompt ? resumePrompt.trim() : ''
  const shouldRestartWithPrompt = restartPrompt.length > 0
  const restartSourcePrompt = session.currentPrompt || session.originalPrompt

  const updates = [
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'running', isVisible: true, lastHeartbeatAt: new Date(), nextEligibleAt: new Date() },
    }),
    enqueueJob({
      userId: session.userId,
      sessionId,
      type: 'session.cycle',
      payload: shouldRestartWithPrompt
        ? { restartPrompt, restartSourcePrompt }
        : {},
    }),
  ]

  if (shouldRestartWithPrompt) {
    updates.push(
      prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'USER',
          content: restartPrompt,
          ...(clientId ? { metadata: JSON.stringify({ clientId }) } : {}),
        },
      })
    )
  }

  await Promise.all(updates)

  await publish(sessionId, EventTypes.STATUS, { status: 'running' })
  res.json({ ok: true })
}))

// ── Stop ──────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sessions/{sessionId}/stop:
 *   post:
 *     summary: Stop a running session
 *     tags: [Sessions]
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
 *         description: Session stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 */
sessionRoutes.post('/:sessionId/stop', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  await Promise.all([
    prisma.job.updateMany({
      where: { sessionId, status: 'queued' },
      data: { status: 'cancelled' },
    }),
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'cancelled' },
    }),
  ])
  abortSessionAiCall(sessionId)

  await publish(sessionId, EventTypes.STATUS, { status: 'stopped' })
  res.json({ ok: true })
}))

// ── Cancel (alias for backward compat) ───────────────────────────────────────

sessionRoutes.post('/:sessionId/cancel', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  await Promise.all([
    prisma.job.updateMany({
      where: { sessionId, status: 'queued' },
      data: { status: 'cancelled' },
    }),
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'cancelled' },
    }),
  ])
  abortSessionAiCall(sessionId)

  await publish(sessionId, EventTypes.STATUS, { status: 'stopped' })
  res.json({ ok: true })
}))
