import { prisma } from '../db/prisma.js'
import { addJobEvent } from '../services/jobEventService.js'
import { enqueueJob } from '../services/jobQueueService.js'
import { bus } from '../services/bus.js'
import { logger } from '../lib/logger.js'
import { EventTypes } from '../lib/eventTypes.js'
import { paceMs } from '../lib/pace.js'
import { isAbortError } from '../services/sessionAbortService.js'
import { MAX_CYCLES } from './constants.js'
import { runPlanningPhase, evolveCycle, getFastIntro } from './planning.js'
import { runPlanCycle } from '../ai/planRuntime.js'
import { insertMediaForCycle } from '../media/insertMediaForCycle.js'

const PHASE = {
  PLANNING: 'planning',
  EXECUTION: 'execution',
  EVOLUTION: 'evolution',
  ENQUEUE: 'enqueue'
}

function titleFromPrompt(prompt) {
  const text = String(prompt || '').trim().replace(/\s+/g, ' ')
  if (!text) return 'Untitled session'
  return text.length > 60 ? text.slice(0, 60).replace(/\s+\S*$/, '…') : text
}

async function getSessionStatus(sessionId) {
  const s = await prisma.aiSession.findUnique({ where: { id: sessionId }, select: { status: true } })
  return s?.status ?? null
}

function parseJobPayload(payloadJson) {
  if (!payloadJson) return {}
  try {
    return JSON.parse(payloadJson)
  } catch {
    return {}
  }
}

function shouldEvolve(ctx) {
  return !ctx.restartInstruction && ctx.cycle > 0
}

function safePublish(publish, ...args) {
  return publish?.(...args).catch(() => {})
}

async function runExecutionPhase(ctx) {
  const cycleNumber = ctx.cycle + 1
  await ctx.publish(ctx.sessionId, EventTypes.PLAN, { steps: ctx.plan.steps.map((s) => s.input), cycle: cycleNumber })
  await addJobEvent(ctx.job.id, 'planned', `Cycle ${cycleNumber}: ${ctx.plan.steps.length} steps`)

  const outputs = await runPlanCycle({
    session: ctx.session,
    sessionId: ctx.sessionId,
    job: ctx.job,
    currentCycle: cycleNumber,
    plan: ctx.plan,
    publish: ctx.publish,
    addJobEvent,
    getSessionStatus,
  })

  ctx.outputs = outputs
  return ctx
}

async function enqueueNextCycle(ctx) {
  if (ctx.cycle >= MAX_CYCLES) {
    await prisma.aiSession.update({ where: { id: ctx.sessionId }, data: { cycleCount: ctx.cycle, status: 'completed' } })
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: 'completed', cycle: ctx.cycle })
    bus.cleanup(ctx.sessionId)
    return ctx
  }

  const delay = paceMs(ctx.session.pace)
  const nextJobAt = new Date(Date.now() + delay)
  await prisma.aiSession.update({
    where: { id: ctx.sessionId },
    data: { cycleCount: ctx.cycle, nextEligibleAt: nextJobAt },
  })

  const afterSession = await prisma.aiSession.findUnique({ where: { id: ctx.sessionId }, select: { status: true } })
  if (!afterSession || afterSession.status === 'cancelled') {
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: 'stopped' })
    bus.cleanup(ctx.sessionId)
    return ctx
  }

  if (afterSession.status === 'paused') {
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: 'paused', cycle: ctx.cycle })
    return ctx
  }

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

export async function runSessionCycle(ctx) {
  ctx.phase = PHASE.PLANNING
  const cycleNumber = ctx.cycle + 1
  const planningPrompt = ctx.hasRestartContext
    ? ctx.previousPrompt
    : (ctx.currentPrompt || ctx.session.currentPrompt || ctx.session.originalPrompt)

  if (ctx.cycle === 0) {
    await insertMediaForCycle({
      sessionId: ctx.sessionId,
      cycle: cycleNumber,
      prompt: planningPrompt,
      publish: ctx.publish,
      kind: 'video'
    })
  }
  // await insertMediaForCycle({ sessionId: ctx.sessionId, cycle: cycleNumber, prompt: planningPrompt, publish: ctx.publish, kind: 'image' })
  // await insertMediaForCycle({ sessionId: ctx.sessionId, cycle: cycleNumber, prompt: planningPrompt, publish: ctx.publish, kind: 'giphy' })

  // Fire fast intro in parallel with planning on first cycle
  const fastIntroPromise = ctx.cycle === 0
    ? getFastIntro({
        session: ctx.session,
        sessionId: ctx.sessionId,
        subject: planningPrompt,
        publish: ctx.publish
      }).catch(() => {})
    : Promise.resolve()

  const plan = await runPlanningPhase({
    session: ctx.session,
    sessionId: ctx.sessionId,
    jobId: ctx.jobId,
    cycle: ctx.cycle,
    currentPrompt: planningPrompt,
    previousPrompt: ctx.previousPrompt,
    restartInstruction: ctx.restartInstruction
  })

  // Wait for fast intro to complete (fire and forget, but ensure it finishes before we continue)
  await fastIntroPromise

  if (ctx.cycle === 0) {
    await prisma.aiSession.update({
      where: { id: ctx.sessionId },
      data: {
        ...(!ctx.session.title && { title: titleFromPrompt(ctx.session.originalPrompt) }),
        promptCount: plan.steps.length,
        currentPrompt: ctx.session.originalPrompt,
      },
    })
  } else if (ctx.restartInstruction && ctx.previousPrompt) {
    await prisma.aiSession.update({
      where: { id: ctx.sessionId },
      data: { currentPrompt: ctx.restartInstruction, promptCount: plan.steps.length }
    })
  } else {
    await prisma.aiSession.update({ where: { id: ctx.sessionId }, data: { promptCount: plan.steps.length } })
  }

  ctx.phase = PHASE.EXECUTION
  ctx.plan = plan
  ctx.currentPrompt = planningPrompt
  ctx = await runExecutionPhase(ctx)

  if (ctx.outputs.paused) {
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: 'paused', cycle: cycleNumber })
    return ctx
  }
  if (ctx.outputs.stopped) {
    await ctx.publish(ctx.sessionId, EventTypes.STATUS, { status: 'stopped' })
    bus.cleanup(ctx.sessionId)
    return ctx
  }

  if (shouldEvolve(ctx)) {
    ctx.phase = PHASE.EVOLUTION
    const evolved = await evolveCycle(ctx)
    Object.assign(ctx, evolved)
    await prisma.aiSession.update({ where: { id: ctx.sessionId }, data: { currentPrompt: ctx.currentPrompt } })
  } else {
    ctx.cycle = (ctx.cycle ?? 0) + 1
  }

  ctx.phase = PHASE.ENQUEUE
  return enqueueNextCycle(ctx)
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
  const cycle = session.cycleCount ?? 0
  const cycleNumber = cycle + 1
  const payload = parseJobPayload(job.payloadJson)
  const restartInstruction = String(payload.restartPrompt || '').trim()
  const restartSourcePrompt = String(payload.restartSourcePrompt || '').trim()
  const hasRestartContext = Boolean(restartInstruction && restartSourcePrompt)
  if (hasRestartContext) {
    await prisma.job.update({
      where: { id: job.id },
      data: { payloadJson: JSON.stringify({}) }
    }).catch(() => {})
  }
  await prisma.aiSession.update({ where: { id: sessionId }, data: { status: 'running' } })
  await publish(sessionId, EventTypes.STATUS, { status: isFirstCycle ? 'planning' : 'expanding', cycle: cycleNumber })

  const cycleCtx = {
    session,
    sessionId,
    jobId: job.id,
    job,
    publish,
    cycle,
    phase: null,
    plan: null,
    outputs: null,
    restartInstruction,
    previousPrompt: restartSourcePrompt,
    currentPrompt: session.currentPrompt || session.originalPrompt,
    hasRestartContext
  }
  Object.seal(cycleCtx)

  try {
    await runSessionCycle(cycleCtx)
  } catch (error) {
    const errorPayload = {
      type: 'session_error',
      ts: Date.now(),
      sessionId: cycleCtx.sessionId,
      phase: cycleCtx.phase || 'unknown',
      cycle: cycleCtx.cycle,
      error: String(error?.message || error),
      stack: String(error?.stack || '').split('\n').slice(0, 4).join(' | ')
    }

    logger.error('Session cycle failed', errorPayload)
    await safePublish(publish, sessionId, EventTypes.ERROR, errorPayload)

    if (!isAbortError(error)) throw error
    const statusAfterAbort = await getSessionStatus(sessionId)
    if (statusAfterAbort === 'cancelled') {
      await publish(sessionId, EventTypes.STATUS, { status: 'stopped' })
      bus.cleanup(sessionId)
      return
    }
    if (statusAfterAbort === 'paused') {
      await publish(sessionId, EventTypes.STATUS, { status: 'paused', cycle: cycleNumber })
      return
    }
    throw error
  }
}
