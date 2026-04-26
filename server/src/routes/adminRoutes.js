import { Router } from 'express'
import { prisma } from '../db/prisma.js'
import { getGovernorState } from '../services/aiGovernor.js'
import { requireAdmin } from '../middleware/permissions.js'
import { bus } from '../services/bus.js'
import { route } from '../lib/route.js'
import { optionalInt, requireId } from '../lib/validation.js'
import { EventTypes } from '../lib/eventTypes.js'
import { currentMonthWindow } from '../utils/monthWindow.js'

export const adminRoutes = Router()

// ── Queue snapshot ────────────────────────────────────────────────────────────

adminRoutes.get('/queue', requireAdmin, route(async (_req, res) => {
  const counts = await prisma.job.groupBy({
    by: ['status'],
    _count: { status: true },
  })

  res.json({
    ok: true,
    queue: counts,
    governor: getGovernorState(),
  })
}))

adminRoutes.get('/jobs', requireAdmin, route(async (req, res) => {
  const take = optionalInt(req.query?.take, 'take', { min: 1, max: 100, fallback: 50 })
  const jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' }, take })
  res.json({ ok: true, jobs })
}))

// ── Online users (near real-time) ─────────────────────────────────────────────

adminRoutes.get('/online', requireAdmin, route(async (_req, res) => {
  const now = new Date()
  const oneHourAgo  = new Date(now - 3_600_000)
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const { start: monthStart, end: monthEnd } = currentMonthWindow()

  const activeSessions = await prisma.aiSession.findMany({
    where: {
      isVisible: true,
      status: { notIn: ['cancelled', 'completed', 'failed'] },
    },
    include: {
      user: { select: { id: true, email: true, name: true, plan: true } },
    },
    orderBy: { lastHeartbeatAt: 'desc' },
  })

  const sessionIds = activeSessions.map(s => s.id)
  const userIds    = [...new Set(activeSessions.map(s => s.userId))]

  // Run all aggregation queries in parallel
  const [sessionTokenAggs, monthlyUserAggs, hourAgg, dayAgg] = await Promise.all([
    sessionIds.length
      ? prisma.usageLedger.groupBy({
          by: ['sessionId'],
          where: {
            sessionId: { in: sessionIds },
            status: { in: ['SUCCESS', 'ESTIMATED', 'STARTED'] },
          },
          _sum: { actualTotalTokens: true, estimatedPromptTokens: true },
          _count: { id: true },
        })
      : [],

    userIds.length
      ? prisma.usageLedger.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            createdAt: { gte: monthStart, lt: monthEnd },
            status: { in: ['SUCCESS', 'ESTIMATED'] },
          },
          _sum: { actualTotalTokens: true, estimatedPromptTokens: true },
          _count: { id: true },
        })
      : [],

    prisma.usageLedger.aggregate({
      where: { createdAt: { gte: oneHourAgo }, status: { in: ['SUCCESS', 'ESTIMATED'] } },
      _sum: { actualTotalTokens: true, estimatedPromptTokens: true },
      _count: { id: true },
    }),

    prisma.usageLedger.aggregate({
      where: { createdAt: { gte: todayStart }, status: { in: ['SUCCESS', 'ESTIMATED'] } },
      _sum: { actualTotalTokens: true, estimatedPromptTokens: true },
      _count: { id: true },
    }),
  ])

  const tokensBySession = Object.fromEntries(
    sessionTokenAggs.map(t => [t.sessionId, {
      tokens: Number(t._sum.actualTotalTokens || t._sum.estimatedPromptTokens || 0),
      calls:  t._count.id,
    }])
  )

  const monthlyByUser = Object.fromEntries(
    monthlyUserAggs.map(t => [t.userId, {
      tokens:  Number(t._sum.actualTotalTokens || t._sum.estimatedPromptTokens || 0),
      prompts: t._count.id,
    }])
  )

  const tokens = (agg) =>
    Number(agg._sum.actualTotalTokens || agg._sum.estimatedPromptTokens || 0)

  res.json({
    ok: true,
    ts: now.toISOString(),
    stats: {
      activeSessions: activeSessions.length,
      tokensLastHour: tokens(hourAgg),
      tokensToday:    tokens(dayAgg),
      callsLastHour:  hourAgg._count.id,
      callsToday:     dayAgg._count.id,
    },
    sessions: activeSessions.map(s => ({
      sessionId:      s.id,
      userId:         s.userId,
      email:          s.user.email,
      name:           s.user.name,
      plan:           s.user.plan,
      status:         s.status,
      cycleCount:     s.cycleCount,
      pace:           s.pace,
      promptCount:    s.promptCount,
      lastHeartbeatAt: s.lastHeartbeatAt,
      sessionTokens:  tokensBySession[s.id]?.tokens ?? 0,
      sessionCalls:   tokensBySession[s.id]?.calls  ?? 0,
      monthlyTokens:  monthlyByUser[s.userId]?.tokens  ?? 0,
      monthlyPrompts: monthlyByUser[s.userId]?.prompts ?? 0,
    })),
  })
}))

// ── Admin force-stop session ──────────────────────────────────────────────────

adminRoutes.post('/sessions/:sessionId/stop', requireAdmin, route(async (req, res) => {
  const sessionId = requireId(req.params.sessionId, 'sessionId')

  await Promise.all([
    prisma.job.updateMany({ where: { sessionId, status: 'queued' }, data: { status: 'cancelled' } }),
    prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'cancelled' } }),
  ])

  bus.publish(sessionId, { type: EventTypes.STATUS, payload: { status: 'stopped' }, ts: Date.now() })
  res.json({ ok: true })
}))
