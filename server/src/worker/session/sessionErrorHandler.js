import { logger } from '../../lib/logger.js'
import { EventTypes } from '../../lib/eventTypes.js'
import { isAbortError } from '../../services/sessionAbortService.js'
import { bus } from '../../services/bus.js'
import { getSessionStatus } from './sessionContext.js'
import { safePublish } from './sessionUtils.js'

export async function handleSessionError(error, ctx, publish, cycleNumber) {
  const errorPayload = {
    type: 'session_error',
    ts: Date.now(),
    sessionId: ctx.sessionId,
    phase: ctx.phase || 'unknown',
    cycle: ctx.cycle,
    error: String(error?.message || error),
    stack: String(error?.stack || '').split('\n').slice(0, 4).join(' | ')
  }

  logger.error('Session cycle failed', errorPayload)
  await safePublish(publish, ctx.sessionId, EventTypes.ERROR, errorPayload)

  if (!isAbortError(error)) throw error

  const statusAfterAbort = await getSessionStatus(ctx.sessionId)
  if (statusAfterAbort?.status === 'cancelled') {
    await publish(ctx.sessionId, EventTypes.STATUS, { status: 'stopped' })
    bus.cleanup(ctx.sessionId)
    return
  }
  if (statusAfterAbort?.status === 'paused') {
    await publish(ctx.sessionId, EventTypes.STATUS, { status: 'paused', cycle: cycleNumber })
    return
  }
  throw error
}
