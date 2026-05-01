import { prisma } from '../db/prisma.js'
import { runPlanTask } from './planLimiter.js'
import { runAccountedAiCall } from '../services/usageService.js'
import { callAIRich } from '../services/openaiClient.js'
import { beginSessionAiCall, endSessionAiCall, abortSessionAiCall } from '../services/sessionAbortService.js'
import { EventTypes } from '../lib/eventTypes.js'
import { buildProcessPrompt } from '../worker/prompts.js'
import { checkPlanState } from './planState.js'
import { logger } from '../lib/logger.js'
import { emitMetric } from '../lib/metrics.js'

const STEP_TIMEOUT_MS = Number(process.env.MAX_STEP_DURATION_MS || 45_000)

function stripFences(text) {
  return String(text).trim().replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

export async function executePlanStep({
  session,
  sessionId,
  job,
  cycle,
  step,
  index,
  totalSteps,
  publish,
  addJobEvent,
  getSessionStatus,
}) {
  await publish(sessionId, EventTypes.PROMPT_START, { index, cycle })

  const promptText = buildProcessPrompt({
    prompt: step.input,
    position: cycle * 100 + index
  })
  const signal = beginSessionAiCall(sessionId)
  let outputResult
  let slotMetrics = null
  let runAccountedAiCallDurationMs = 0
  let stepTimeoutTimer
  try {
    outputResult = await Promise.race([
      runPlanTask(async () => {
        const startedAt = Date.now()
        const result = await runAccountedAiCall({
          userId: session.userId,
          sessionId,
          jobId: job.id,
          phase: `process_${cycle}_${index}`,
          prompt: step.input,
          callAi: () =>
            callAIRich({
              system: promptText.system,
              user: promptText.user,
              temperature: 0.5,
              signal,
            }),
        })
        runAccountedAiCallDurationMs = Date.now() - startedAt
        return result
      }).then(({ result, slotMetrics: metrics }) => {
        slotMetrics = metrics
        return result
      }),
      new Promise((_, reject) => {
        stepTimeoutTimer = setTimeout(() => {
          abortSessionAiCall(sessionId)
          const timeoutError = new Error('STEP_TIMEOUT')
          timeoutError.code = 'STEP_TIMEOUT'
          reject(timeoutError)
        }, STEP_TIMEOUT_MS)
      }),
    ])
  } finally {
    if (stepTimeoutTimer) clearTimeout(stepTimeoutTimer)
    endSessionAiCall(sessionId, signal)
  }

  emitMetric('ai_queue_wait_ms', slotMetrics?.aiQueueWaitMs ?? 0, {
    sessionId,
    jobId: job.id,
    cycle,
    index,
    aiActiveCount: slotMetrics?.aiActiveCount ?? null,
    aiMaxConcurrent: slotMetrics?.aiMaxConcurrent ?? null,
  })
  emitMetric('run_accounted_ai_call_duration_ms', runAccountedAiCallDurationMs, {
    sessionId,
    jobId: job.id,
    cycle,
    index,
  })

  let blocked = await checkPlanState(sessionId, getSessionStatus)
  if (blocked) return blocked

  const html = stripFences(outputResult.text)

  const [, savedMsg] = await Promise.all([
    prisma.aiOutput.create({
      data: { sessionId, cycle, index, title: '_', html },
    }),
    prisma.chatMessage.create({
      data: { sessionId, role: 'ASSISTANT', content: html, metadata: JSON.stringify({ cycle, index }) },
    }),
  ])
  await publish(sessionId, EventTypes.OUTPUT, {
    index,
    html,
    cycle,
    messageId: savedMsg.id,
    createdAt: savedMsg.createdAt.toISOString(),
  })
  addJobEvent(job.id, 'output', `Cycle ${cycle} step ${index + 1}/${totalSteps} done`).catch(() => {})

  blocked = await checkPlanState(sessionId, getSessionStatus)
  if (blocked) return blocked

  return null
}

