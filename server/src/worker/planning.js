import { runGoverned } from '../services/aiGovernor.js'
import { runAccountedAiCall } from '../services/usageService.js'
import { callPlannerStructured } from '../services/openaiClient.js'
import { normalizePlan } from '../agents/plannerAgent.js'
import { PLAN_TOOL_SCHEMA, PROMPT_COUNT } from './constants.js'
import { buildCyclePlannerPrompt, buildInitialPlannerPrompt } from './prompts.js'
import { getRandomNotice } from './notices.js'
import { EventTypes } from '../lib/eventTypes.js'
import { logger } from '../lib/logger.js'

export async function buildInitialPlan({ session, sessionId, jobId, publish }) {
  const promptText = buildInitialPlannerPrompt({
    originalPrompt: session.originalPrompt,
    promptCount: PROMPT_COUNT,
  })

  if (publish) {
    const noticeMessage = getRandomNotice()
    logger.info('[planning] Publishing notice event', { sessionId, message: noticeMessage })
    await publish(sessionId, EventTypes.NOTICE, { message: noticeMessage })
  }

  const planResult = await runGoverned(() =>
    runAccountedAiCall({
      userId: session.userId,
      sessionId,
      jobId,
      phase: 'planner',
      prompt: session.originalPrompt,
      callAi: () => callPlannerStructured({
        system: promptText.system,
        user: promptText.user,
        temperature: 0.4,
        count: PROMPT_COUNT,
        responseSchema: PLAN_TOOL_SCHEMA,
      }),
    })
  )
  return normalizePlan(planResult, PROMPT_COUNT)
}

export async function buildCyclePlan({ session, sessionId, jobId, currentCycle, publish }) {
  const promptText = buildCyclePlannerPrompt({
    originalPrompt: session.originalPrompt,
    promptCount: PROMPT_COUNT,
  })

  if (publish) {
    const noticeMessage = getRandomNotice()
    logger.info('[planning] Publishing notice event', { sessionId, message: noticeMessage })
    await publish(sessionId, EventTypes.NOTICE, { message: noticeMessage })
  }

  const planResult = await runGoverned(() =>
    runAccountedAiCall({
      userId: session.userId,
      sessionId,
      jobId,
      phase: `cycle_plan_${currentCycle}`,
      prompt: session.originalPrompt,
      callAi: () => callPlannerStructured({
        system: promptText.system,
        user: promptText.user,
        temperature: 0.5,
        count: PROMPT_COUNT,
        responseSchema: PLAN_TOOL_SCHEMA,
      }),
    })
  )
  return normalizePlan(planResult, PROMPT_COUNT)
}
