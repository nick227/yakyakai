import { Router } from 'express'
import { prisma } from '../db/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { assertOwnsSession } from '../middleware/permissions.js'
import { enqueueJob } from '../services/jobQueueService.js'
import { bus } from '../services/bus.js'
import { route } from '../lib/route.js'
import { requireString, requireId } from '../lib/validation.js'
import { forbidden } from '../lib/httpError.js'
import { EventTypes } from '../lib/eventTypes.js'
import { VALID_PACES } from '../lib/pace.js'
import { logger } from '../lib/logger.js'

export const sessionRoutes = Router()

// Track active SSE connections per user
const activeSseConnections = new Map()
const MAX_SSE_CONNECTIONS_PER_USER = 5

// ── Start ─────────────────────────────────────────────────────────────────────

sessionRoutes.post('/start', requireAuth, route(async (req, res) => {
  const originalPrompt = requireString(req.body?.prompt, 'prompt', { max: 24_000 })
  const pace = VALID_PACES.includes(req.body?.pace) ? req.body.pace : 'steady'

  logger.info('Session start', { userId: req.user.id, pace, promptLength: originalPrompt.length })

  const session = await prisma.aiSession.create({
    data: {
      userId: req.user.id,
      title: originalPrompt.slice(0, 80),
      originalPrompt,
      status: 'queued',
      pace,
      isVisible: true,
      lastHeartbeatAt: new Date(),
      messages: {
        create: {
          role: 'USER',
          content: originalPrompt,
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

sessionRoutes.get('/:sessionId', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  const session = await prisma.aiSession.findFirst({
    where: { id: sessionId, userId: req.user.id },
  })
  if (!session) throw forbidden('SESSION_ACCESS_DENIED', 'You do not have access to this session.')
  res.json({ ok: true, session })
}))

// ── Messages (paginated) ───────────────────────────────────────────────────────

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
    let afterEventId = null  // CUID cursor; null means "from connection time"

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
            send(parsed)
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

  await prisma.aiSession.updateMany({
    where: { id: sessionId, userId: req.user.id },
    data: { lastHeartbeatAt: new Date(), isVisible: visible },
  })

  res.sendStatus(204)
}))

// ── Pause ─────────────────────────────────────────────────────────────────────

sessionRoutes.post('/:sessionId/pause', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  await assertOwnsSession(req.user.id, sessionId)

  await Promise.all([
    prisma.job.updateMany({
      where: { sessionId, status: 'queued', type: { in: ['session.cycle', 'session.start'] } },
      data: { status: 'cancelled' },
    }),
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'paused', isVisible: false },
    }),
  ])

  bus.publish(sessionId, { type: EventTypes.STATUS, payload: { status: 'paused' }, ts: Date.now() })
  res.json({ ok: true })
}))

// ── Resume ────────────────────────────────────────────────────────────────────

sessionRoutes.post('/:sessionId/resume', requireAuth, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')
  const session = await assertOwnsSession(req.user.id, sessionId)

  await Promise.all([
    prisma.aiSession.update({
      where: { id: sessionId },
      data: { status: 'running', isVisible: true, lastHeartbeatAt: new Date(), nextEligibleAt: new Date() },
    }),
    enqueueJob({
      userId: session.userId,
      sessionId,
      type: 'session.cycle',
      payload: {},
    }),
  ])

  bus.publish(sessionId, { type: EventTypes.STATUS, payload: { status: 'running' }, ts: Date.now() })
  res.json({ ok: true })
}))

// ── Stop ──────────────────────────────────────────────────────────────────────

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

  bus.publish(sessionId, { type: EventTypes.STATUS, payload: { status: 'stopped' }, ts: Date.now() })
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

  bus.publish(sessionId, { type: EventTypes.STATUS, payload: { status: 'stopped' }, ts: Date.now() })
  res.json({ ok: true })
}))
