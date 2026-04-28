import { prisma } from '../db/prisma.js'
import { runPlanTask } from './planLimiter.js'
import { runAccountedAiCall } from '../services/usageService.js'
import { callAIRich } from '../services/openaiClient.js'
import { beginSessionAiCall, endSessionAiCall } from '../services/sessionAbortService.js'
import { EventTypes } from '../lib/eventTypes.js'
import { buildProcessPrompt } from '../worker/prompts.js'
import { checkPlanState } from './planState.js'

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
  priorHtml,
  publish,
  addJobEvent,
  getSessionStatus,
}) {
  await publish(sessionId, EventTypes.PROMPT_START, { index, cycle })

  const promptText = buildProcessPrompt({ prompt: step.input })
  const signal = beginSessionAiCall(sessionId)
  let outputResult
  try {
    outputResult = await runPlanTask(() =>
      runAccountedAiCall({
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
    )
  } finally {
    endSessionAiCall(sessionId, signal)
  }

  let blocked = await checkPlanState(sessionId, getSessionStatus)
  if (blocked) return blocked

  const html = stripFences(outputResult.text)

  priorHtml.push(html)
  await prisma.aiOutput.create({
    data: {
      sessionId,
      cycle,
      index,
      title: '_',
      html,
    },
  })
  const savedMsg = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: html,
      metadata: JSON.stringify({ cycle, index }),
    },
  })
  await prisma.aiSession.update({
    where: { id: sessionId },
    data: { lastHeartbeatAt: new Date() },
  })
  await publish(sessionId, EventTypes.OUTPUT, {
    index,
    html,
    cycle,
    messageId: savedMsg.id,
    createdAt: savedMsg.createdAt.toISOString(),
  })
  await addJobEvent(job.id, 'output', `Cycle ${cycle} step ${index + 1}/${totalSteps} done`)

  blocked = await checkPlanState(sessionId, getSessionStatus)
  if (blocked) return blocked

  return null
}

