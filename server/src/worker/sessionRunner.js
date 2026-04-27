import { prisma } from '../db/prisma.js'
import { addJobEvent } from '../services/jobEventService.js'
import { enqueueJob } from '../services/jobQueueService.js'
import { bus } from '../services/bus.js'
import { logger } from '../lib/logger.js'
import { EventTypes } from '../lib/eventTypes.js'
import { paceMs } from '../lib/pace.js'
import { MAX_CYCLES } from './constants.js'
import { buildCyclePlan, buildInitialPlan } from './planning.js'
import { processPrompts } from './processing.js'

async function getSessionStatus(sessionId) {
  const s = await prisma.aiSession.findUnique({ where: { id: sessionId }, select: { status: true } })
  return s?.status ?? null
}

export async function runSessionJob(job, { publish }) {
  const sessionId = job.sessionId
  if (!sessionId) throw new Error('Job missing sessionId')

  logger.info('Starting job processing', { sessionId, jobId: job.id })
  const session = await prisma.aiSession.findUnique({ where: { id: sessionId } })
  if (!session) throw new Error(`AiSession ${sessionId} not found`)
  if (session.status === 'cancelled') {
    logger.info('Session already cancelled, skipping job', { sessionId })
    return
  }

  const isFirstCycle = session.cycleCount === 0
  const currentCycle = session.cycleCount + 1
  await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'running' } })
  await publish(sessionId, EventTypes.STATUS, { status: isFirstCycle ? 'planning' : 'expanding', cycle: currentCycle })

  let plan
  if (isFirstCycle) {
    plan = await buildInitialPlan({ session, sessionId, jobId: job.id, publish })
    await prisma.aiSession.update({
      where: { id: sessionId },
      data: { title: plan.title, promptCount: plan.prompts.length },
    })
  } else {
    plan = await buildCyclePlan({ session, sessionId, jobId: job.id, currentCycle, publish })
    await prisma.aiSession.update({ where: { id: sessionId }, data: { promptCount: plan.prompts.length } })
  }

  await publish(sessionId, EventTypes.PLAN, { prompts: plan.prompts.map((p) => p.prompt), cycle: currentCycle })
  await addJobEvent(job.id, 'planned', `Cycle ${currentCycle}: ${plan.prompts.length} prompts`)

  const processed = await processPrompts({
    session,
    sessionId,
    job,
    currentCycle,
    plan,
    publish,
    addJobEvent,
    getSessionStatus,
  })
  if (processed.paused) {
    await publish(sessionId, EventTypes.STATUS, { status: 'paused', cycle: currentCycle })
    return
  }
  if (processed.stopped) {
    await publish(sessionId, EventTypes.STATUS, { status: 'stopped' })
    bus.cleanup(sessionId)
    return
  }

  const afterSession = await prisma.aiSession.findUnique({ where: { id: sessionId }, select: { status: true } })
  if (!afterSession || afterSession.status === 'cancelled') {
    await publish(sessionId, EventTypes.STATUS, { status: 'stopped' })
    bus.cleanup(sessionId)
    return
  }

  const newCycleCount = session.cycleCount + 1
  if (newCycleCount >= MAX_CYCLES) {
    await prisma.aiSession.update({ where: { id: sessionId }, data: { cycleCount: newCycleCount, status: 'completed' } })
    await publish(sessionId, EventTypes.STATUS, { status: 'completed', cycle: newCycleCount })
    bus.cleanup(sessionId)
    return
  }

  const delay = paceMs(session.pace)
  const nextJobAt = new Date(Date.now() + delay)
  await prisma.aiSession.update({
    where: { id: sessionId },
    data: { cycleCount: newCycleCount, nextEligibleAt: nextJobAt },
  })

  if (afterSession.status === 'paused') {
    await publish(sessionId, EventTypes.STATUS, { status: 'paused', cycle: newCycleCount })
    return
  }

  await publish(sessionId, EventTypes.STATUS, { status: 'cycling', cycle: newCycleCount, pace: session.pace, nextIn: delay })
  await enqueueJob({
    userId: session.userId,
    sessionId,
    type: 'session.cycle',
    payload: {},
    runAt: nextJobAt,
  })
}
