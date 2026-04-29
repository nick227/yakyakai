import { runPlanTask } from '../ai/planLimiter.js'
import { runAccountedAiCall } from '../services/usageService.js'
import { callPlannerStructured, callAI } from '../services/openaiClient.js'
import { beginSessionAiCall, endSessionAiCall } from '../services/sessionAbortService.js'
import { normalizePlan } from '../agents/plannerAgent.js'
import { PLAN_TOOL_SCHEMA, PROMPT_COUNT } from './constants.js'
import {
  buildPlannerPrompt,
  buildRestartPlannerPrompt,
  buildNextPromptPrompt
} from './prompts.js'
import { getRandomNotice } from './notices.js'
import { publishNotice } from './events.js'

/**
 * Tuned temperatures by task type.
 */
const TEMP = {
  initialPlan: 0.4,
  cyclePlan: 0.5,
  nextPrompt: 0.7
}

/* -------------------------------------------------------------------------- */
/* Core Helpers                                                               */
/* -------------------------------------------------------------------------- */

async function runPlanningStep({
  session,
  sessionId,
  jobId,
  phase,
  temperature,
  buildPrompt
}) {
  const promptText = buildPrompt()
  const signal = beginSessionAiCall(sessionId)
  try {
    const rawPlan = await runPlanTask(() =>
      runAccountedAiCall({
        userId: session.userId,
        sessionId,
        jobId,
        phase,
        prompt: promptText.user,
        callAi: () =>
          callPlannerStructured({
            system: promptText.system,
            user: promptText.user,
            temperature,
            signal,
            count: PROMPT_COUNT,
            responseSchema: PLAN_TOOL_SCHEMA
          })
      })
    )

    return normalizePlan(rawPlan, PROMPT_COUNT)
  } finally {
    endSessionAiCall(sessionId, signal)
  }
}

async function initial(ctx) {
  return runPlanningStep({
    ...ctx,
    phase: 'planner.initial',
    temperature: TEMP.initialPlan,
    buildPrompt: () =>
      buildPlannerPrompt({
        subject: ctx.session.originalPrompt,
        promptCount: PROMPT_COUNT
      })
  })
}

async function next(ctx) {
  const subject = ctx.currentPrompt || ctx.session.originalPrompt
  const cycleNumber = (ctx.cycle ?? 0) + 1

  return runPlanningStep({
    ...ctx,
    phase: `planner.cycle.${cycleNumber}`,
    temperature: TEMP.cyclePlan,
    buildPrompt: () =>
      buildPlannerPrompt({
        subject,
        promptCount: PROMPT_COUNT
      })
  })
}

async function restart(ctx) {
  const cycleNumber = (ctx.cycle ?? 0) + 1

  return runPlanningStep({
    ...ctx,
    phase: `planner.restart.${cycleNumber}`,
    temperature: TEMP.cyclePlan,
    buildPrompt: () =>
      buildRestartPlannerPrompt({
        previousPrompt: ctx.previousPrompt,
        restartInstruction: ctx.restartInstruction,
        promptCount: PROMPT_COUNT
      })
  })
}

export async function runPlanningPhase(ctx) {
  await publishNotice(ctx.sessionId, getRandomNotice())

  if (ctx.restartInstruction) {
    return restart(ctx)
  }

  const cycle = ctx.cycle ?? 0
  if (cycle === 0) {
    return initial(ctx)
  }

  return next(ctx)
}

/* -------------------------------------------------------------------------- */
/* Adjacent Prompt Discovery                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generates one new related direction to explore next.
 */
export async function getNextPrompt({
  session,
  sessionId,
  jobId,
  currentPrompt
}) {
  const signal = beginSessionAiCall(sessionId)
  const promptText = buildNextPromptPrompt({
    currentPrompt
  })

  try {
    const result = await runPlanTask(() =>
      runAccountedAiCall({
        userId: session.userId,
        sessionId,
        jobId,
        phase: 'planner.next',
        prompt: promptText.user,
        callAi: () =>
          callAI({
            system: promptText.system,
            user: promptText.user,
            temperature: TEMP.nextPrompt,
            signal
          })
      })
    )

    return result.trim()
  } finally {
    endSessionAiCall(sessionId, signal)
  }
}

export async function selectNextDirection(ctx) {
  return getNextPrompt(ctx)
}

export async function evolveCycle(ctx) {
  const nextPrompt = await selectNextDirection(ctx)
  return { ...ctx, currentPrompt: nextPrompt, cycle: (ctx.cycle ?? 0) + 1 }
}
