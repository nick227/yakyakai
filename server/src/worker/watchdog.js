import { prisma } from '../db/prisma.js'
import { logger } from '../lib/logger.js'
import { EventTypes } from '../lib/eventTypes.js'
import { publish } from './events.js'

const JOB_LOCK_TIMEOUT_MS = 8 * 60 * 1000
const SESSION_ORPHAN_TIMEOUT_MS = 15 * 60 * 1000
const ACTIVE_SESSION_STATUSES = ['queued', 'planning', 'running', 'cycling', 'expanding']

let watchdogRunning = false

export async function recoverStaleRunningSessions() {
  const staleRunMs = Number(process.env.WORKER_RECOVERY_STALE_MS || 180_000)
  const staleAt = new Date(Date.now() - staleRunMs)
  const staleSessions = await prisma.aiSession.findMany({
    where: {
      status: { in: ['planning', 'running', 'expanding', 'cycling'] },
      updatedAt: { lt: staleAt },
    },
    select: { id: true },
    take: 1000,
  })
  if (staleSessions.length === 0) return

  const staleIds = staleSessions.map((s) => s.id)
  await prisma.$transaction([
    prisma.job.updateMany({
      where: { sessionId: { in: staleIds }, status: { in: ['queued', 'running', 'paused'] } },
      data: { status: 'cancelled' },
    }),
    prisma.aiSession.updateMany({
      where: { id: { in: staleIds } },
      data: { status: 'failed', isVisible: false },
    }),
  ])
  logger.warn('Recovered stale running sessions at startup', { count: staleIds.length })
}

async function resetStuckJobLocks() {
  const lockedBefore = new Date(Date.now() - JOB_LOCK_TIMEOUT_MS)
  const { count } = await prisma.job.updateMany({
    where: { status: 'running', lockedAt: { lt: lockedBefore } },
    data: { status: 'queued', lockedAt: null, lockedBy: null },
  })
  if (count > 0) logger.warn('Watchdog reset stuck job locks', { count })
}

async function failOrphanedSessions() {
  const orphanedBefore = new Date(Date.now() - SESSION_ORPHAN_TIMEOUT_MS)
  const orphaned = await prisma.aiSession.findMany({
    where: {
      status: { in: ACTIVE_SESSION_STATUSES },
      updatedAt: { lt: orphanedBefore },
      jobs: { none: { status: { in: ['queued', 'running'] } } },
    },
    select: { id: true },
  })
  for (const session of orphaned) {
    try {
      await prisma.aiSession.update({
        where: { id: session.id },
        data: { status: 'failed' },
      })
      await publish(session.id, EventTypes.STATUS, { status: 'failed', code: 'ORPHANED' })
      logger.warn('Watchdog failed orphaned session', { sessionId: session.id })
    } catch (err) {
      logger.error('Watchdog failed to recover orphaned session', { sessionId: session.id, error: err.message })
    }
  }
}

export async function runWatchdog() {
  if (watchdogRunning) return
  watchdogRunning = true
  try {
    const staleTimeoutMs = Number(process.env.WATCHDOG_STALE_TIMEOUT_MS || 120_000)
    const staleAt = new Date(Date.now() - staleTimeoutMs)
    const { count } = await prisma.aiSession.updateMany({
      where: {
        isVisible: true,
        lastHeartbeatAt: { not: null, lt: staleAt },
        status: { notIn: ['cancelled', 'completed', 'failed'] },
      },
      data: { isVisible: false },
    })
    if (count > 0) logger.info('Watchdog expired stale sessions', { count })
    await resetStuckJobLocks()
    await failOrphanedSessions()
  } finally {
    watchdogRunning = false
  }
}
