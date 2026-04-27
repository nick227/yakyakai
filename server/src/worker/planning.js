import { runGoverned } from '../services/aiGovernor.js'
import { runAccountedAiCall } from '../services/usageService.js'
import { callPlannerStructured, callAI } from '../services/openaiClient.js'
import { beginSessionAiCall, endSessionAiCall } from '../services/sessionAbortService.js'
import { normalizePlan } from '../agents/plannerAgent.js'
import { PLAN_TOOL_SCHEMA, PROMPT_COUNT } from './constants.js'
import {
  buildPlannerPrompt,
  buildNextPromptPrompt
} from './prompts.js'
import { getRandomNotice } from './notices.js'
import { EventTypes } from '../lib/eventTypes.js'
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

/**
 * Runs any AI call through:
 * 1. concurrency governor
 * 2. usage accounting / limits
 */
async function runManagedAi({
  session,
  sessionId,
  jobId,
  phase,
  prompt,
  callAi,
  signal
}) {
  try {
    return await runGoverned(() =>
      runAccountedAiCall({
        userId: session.userId,
        sessionId,
        jobId,
        phase,
        prompt,
        callAi
      })
    )
  } finally {
    endSessionAiCall(sessionId, signal)
  }
}

/**
 * Sends a lightweight confidence notice to UI during planning.
 */
async function sendPlanningNotice({ sessionId }) {
  await publishNotice(sessionId, getRandomNotice())
}

/* -------------------------------------------------------------------------- */
/* Planner Flows                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Shared planner executor.
 * Used by both first-cycle planning and follow-up cycle planning.
 */
async function executePlanner({
  session,
  sessionId,
  jobId,
  phase,
  promptText,
  temperature
}) {
  const signal = beginSessionAiCall(sessionId)
  const rawPlan = await runManagedAi({
    session,
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
      }),
    signal
  })

  return normalizePlan(rawPlan, PROMPT_COUNT)
}

/**
 * First plan created from original user request.
 */
export async function buildInitialPlan({
  session,
  sessionId,
  jobId,
  publish
}) {
  await sendPlanningNotice({ sessionId })

  const promptText = buildPlannerPrompt({
    subject: session.originalPrompt,
    promptCount: PROMPT_COUNT
  })

  return executePlanner({
    session,
    sessionId,
    jobId,
    phase: 'planner',
    promptText,
    temperature: TEMP.initialPlan
  })
}

/**
 * Future cycles branch into adjacent directions
 * or continue from the current prompt focus.
 */
export async function buildCyclePlan({
  session,
  sessionId,
  jobId,
  currentCycle,
  currentPrompt,
  publish
}) {
  await sendPlanningNotice({ sessionId })

  const sourcePrompt = currentPrompt || session.originalPrompt

  const promptText = buildPlannerPrompt({
    subject: sourcePrompt,
    promptCount: PROMPT_COUNT
  })

  return executePlanner({
    session,
    sessionId,
    jobId,
    phase: `cycle_plan_${currentCycle}`,
    promptText,
    temperature: TEMP.cyclePlan
  })
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

  const result = await runManagedAi({
    session,
    sessionId,
    jobId,
    phase: 'next_prompt',
    prompt: currentPrompt,
    callAi: () =>
      callAI({
        system: promptText.system,
        user: promptText.user,
        temperature: TEMP.nextPrompt,
        signal
      }),
    signal
  })

  return result.trim()
}