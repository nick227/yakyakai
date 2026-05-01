import { prisma } from '../../db/prisma.js'
import { bus } from '../../services/bus.js'
import { enqueueJob } from '../../services/jobQueueService.js'
import { EventTypes } from '../../lib/eventTypes.js'
import { paceMs } from '../../lib/pace.js'
import { MAX_CYCLES } from '../constants.js'
import { completeSession, updateSessionCycleCount } from './sessionState.js'
import { getSessionStatus } from './sessionContext.js'

function shouldEnqueueNextCycle(ctx) {
  return ctx.cycle < MAX_CYCLES
}

async function handleCycleCompletion(ctx) {
  await completeSession(ctx.sessionId, ctx.cycle, ctx.publish)
  return ctx
}

async function handlePausedSession(ctx, afterSession) {
  if (afterSession.status === 'paused' || afterSession.status === 'paused_idle') {
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: afterSession.status, cycle: ctx.cycle })
    return ctx
  }
  return null
}

async function handleCancelledSession(ctx) {
  await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: 'stopped' })
  bus.cleanup(ctx.sessionId)
  return ctx
}

export async function enqueueNextCycle(ctx) {
  if (!shouldEnqueueNextCycle(ctx)) {
    return handleCycleCompletion(ctx)
  }

  const delay = paceMs(ctx.session.pace)
  const nextJobAt = new Date(Date.now() + delay)
  await updateSessionCycleCount(ctx.sessionId, ctx.cycle, nextJobAt)

  const afterSession = await getSessionStatus(ctx.sessionId)
  if (!afterSession || afterSession.status === 'cancelled') {
    return handleCancelledSession(ctx)
  }

  const pausedHandled = await handlePausedSession(ctx, afterSession)
  if (pausedHandled) return pausedHandled

  await ctx.publish(ctx.sessionId, EventTypes.STATUS, {
    status: 'cycling',
    cycle: ctx.cycle,
    pace: ctx.session.pace,
    nextIn: delay
  })
  await enqueueJob({
    userId: ctx.session.userId,
    sessionId: ctx.sessionId,
    type: 'session.cycle',
    payload: {},
    runAt: nextJobAt,
  })

  return ctx
}
