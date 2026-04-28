import { isAbortError } from '../services/sessionAbortService.js'
import { checkPlanState } from './planState.js'
import { executePlanStep } from './planExecutor.js'
import { getEffectivePlanStepDelayMs } from './planStepDelay.js'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function runPlanCycle({
  session,
  sessionId,
  job,
  currentCycle,
  plan,
  publish,
  addJobEvent,
  getSessionStatus,
}) {
  const priorHtml = []
  const steps = plan.steps
  const stepDelayMs = getEffectivePlanStepDelayMs(session)

  for (const [index, step] of steps.entries()) {
    let blocked = await checkPlanState(sessionId, getSessionStatus)
    if (blocked) return blocked

    try {
      blocked = await executePlanStep({
        session,
        sessionId,
        job,
        cycle: currentCycle,
        step,
        index,
        totalSteps: steps.length,
        priorHtml,
        publish,
        addJobEvent,
        getSessionStatus,
      })
    } catch (error) {
      if (!isAbortError(error)) throw error
      blocked = await checkPlanState(sessionId, getSessionStatus)
      if (blocked) return blocked
      throw error
    }

    if (blocked) return blocked

    const hasMore = index < steps.length - 1
    if (hasMore && stepDelayMs > 0) {
      await sleep(stepDelayMs)
    }
  }

  return { stopped: false, paused: false }
}
