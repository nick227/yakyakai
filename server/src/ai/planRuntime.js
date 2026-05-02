import { isAbortError } from '../services/sessionAbortService.js'
import { checkPlanState } from './planState.js'
import { executePlanStep } from './planExecutor.js'
import { getEffectivePlanStepDelayMs } from './planStepDelay.js'
import { logger } from '../lib/logger.js'
import { emitMetric } from '../lib/metrics.js'
import { EventTypes } from '../lib/eventTypes.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STEP_PARALLELISM = Math.max(1, Number(process.env.STEP_PARALLELISM || 2))

function isStepTimeout(error) {
  return error?.code === 'STEP_TIMEOUT' || error?.message === 'STEP_TIMEOUT'
}

function createOrderedOutputPublisher(publish, metricTags, startIndex = 1) {
  let nextIndex = startIndex
  let flushing = false
  let flushPromise = Promise.resolve()
  const pendingOutputs = new Map()
  const skipped = new Set()

  const flush = async () => {
    if (flushing) return
    flushing = true
    try {
      while (true) {
        if (pendingOutputs.has(nextIndex)) {
          const payload = pendingOutputs.get(nextIndex)
          pendingOutputs.delete(nextIndex)
          const publishedAt = Date.now()
          emitMetric('step_published_ms', publishedAt, { ...metricTags, index: nextIndex })
          emitMetric('step_publish_gap_ms', publishedAt - payload.readyAt, { ...metricTags, index: nextIndex })
          await publish(payload.sessionId, EventTypes.OUTPUT, payload.data)
          nextIndex += 1
          continue
        }
        if (skipped.has(nextIndex)) {
          skipped.delete(nextIndex)
          nextIndex += 1
          continue
        }
        break
      }
    } finally {
      flushing = false
    }
  }

  const scheduleFlush = () => {
    flushPromise = flushPromise.then(flush)
    return flushPromise
  }

  return {
    async publishForStep(stepIndex, sessionId, type, data = {}) {
      if (type !== EventTypes.OUTPUT) {
        await publish(sessionId, type, data)
        return
      }
      pendingOutputs.set(stepIndex, { sessionId, data, readyAt: Date.now() })
      emitMetric('step_ready_ms', Date.now(), { ...metricTags, index: stepIndex })
      scheduleFlush().catch(() => {})
    },
    markStepSkipped(stepIndex) {
      skipped.add(stepIndex)
      scheduleFlush().catch(() => {})
    },
    async waitForDrain() {
      await scheduleFlush()
    },
  }
}

export async function runPlanCycle({
  session,
  sessionId,
  job,
  cycleStartedAt,
  currentCycle,
  plan,
  plannerPromise,
  publish,
  addJobEvent,
  getSessionStatus,
}) {
  const stepDelayMs = getEffectivePlanStepDelayMs(session)
  const runtimeStartAt = cycleStartedAt || Date.now()

  // Wait for the real plan — getFastIntro runs concurrently and handles immediate feedback
  let { steps } = plan
  if (plannerPromise) {
    const planned = await plannerPromise
    if (planned?.steps?.length) {
      steps = planned.steps
    }
  }

  const totalSteps = steps.length
  if (totalSteps === 0) return { stopped: false, paused: false }

  const orderedOutput = createOrderedOutputPublisher(publish, {
    sessionId,
    jobId: job?.id,
    cycle: currentCycle,
  }, 0)
  let blockedState = null
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < totalSteps && !blockedState) {
      const index = nextIndex
      nextIndex += 1

      if (index === 0) {
        emitMetric('time_to_first_step_start_ms', Date.now() - runtimeStartAt, {
          sessionId,
          jobId: job?.id,
          cycle: currentCycle,
        })
      }

      let blocked = await checkPlanState(sessionId, getSessionStatus)
      if (blocked) {
        blockedState = blocked
        orderedOutput.markStepSkipped(index)
        return
      }

      try {
        blocked = await executePlanStep({
          session,
          sessionId,
          job,
          cycle: currentCycle,
          step: steps[index],
          index,
          totalSteps,
          publish: (sid, type, data = {}) => orderedOutput.publishForStep(index, sid, type, data),
          addJobEvent,
          getSessionStatus,
        })
      } catch (error) {
        if (isStepTimeout(error)) {
          logger.warn('step timeout; continuing cycle', {
            sessionId,
            jobId: job?.id,
            cycle: currentCycle,
            stepIndex: index,
          })
          orderedOutput.markStepSkipped(index)
          continue
        }
        orderedOutput.markStepSkipped(index)
        if (!isAbortError(error)) throw error
        blocked = await checkPlanState(sessionId, getSessionStatus)
        if (blocked) {
          blockedState = blocked
          return
        }
        throw error
      }

      if (blocked) {
        blockedState = blocked
        orderedOutput.markStepSkipped(index)
        return
      }

      const hasMore = nextIndex < totalSteps
      if (hasMore && stepDelayMs > 0) {
        await sleep(stepDelayMs)
      }
    }
  }

  const parallelism = Math.min(STEP_PARALLELISM, totalSteps)
  await Promise.all(Array.from({ length: parallelism }, () => worker()))
  await orderedOutput.waitForDrain()

  if (blockedState) return blockedState

  return { stopped: false, paused: false }
}
