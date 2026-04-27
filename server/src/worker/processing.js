import { prisma } from '../db/prisma.js'
import { runGoverned } from '../services/aiGovernor.js'
import { runAccountedAiCall } from '../services/usageService.js'
import { callAIRich } from '../services/openaiClient.js'
import { EventTypes } from '../lib/eventTypes.js'
import { buildProcessPriorContext } from './context.js'
import { buildProcessPrompt } from './prompts.js'

export async function processPrompts({
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
  const wordLimit = session.pace === 'fast' ? 150 : session.pace === 'deep' ? 350 : 220

  for (let index = 0; index < plan.prompts.length; index += 1) {
    const statusBeforeCall = await getSessionStatus(sessionId)
    if (statusBeforeCall === 'cancelled') return { stopped: true }
    if (statusBeforeCall === 'paused') return { paused: true }

    const item = plan.prompts[index]
    const priorContext = buildProcessPriorContext(priorHtml)
    await publish(sessionId, EventTypes.PROMPT_START, { index, cycle: currentCycle })

    const promptText = buildProcessPrompt({
      prompt: item.prompt,
      priorContext,
      wordLimit,
      pace: session.pace,
    })
    const outputResult = await runGoverned(() =>
      runAccountedAiCall({
        userId: session.userId,
        sessionId,
        jobId: job.id,
        phase: `process_${currentCycle}_${index}`,
        prompt: item.prompt,
        callAi: () => callAIRich({
          system: promptText.system,
          user: promptText.user,
          temperature: 0.5,
        }),
      })
    )
    const html = outputResult.text

    priorHtml.push(html)
    await prisma.aiOutput.create({
      data: {
        sessionId,
        cycle: currentCycle,
        index,
        title: '_',
        html,
      },
    })
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'ASSISTANT',
        content: html,
        metadata: JSON.stringify({ cycle: currentCycle, index }),
      },
    })
    await publish(sessionId, EventTypes.OUTPUT, { index, html, cycle: currentCycle })
    await addJobEvent(job.id, 'output', `Cycle ${currentCycle} prompt ${index + 1}/${plan.prompts.length} done`)

    const statusAfterOutput = await getSessionStatus(sessionId)
    if (statusAfterOutput === 'cancelled') return { stopped: true }
    if (statusAfterOutput === 'paused') return { paused: true }
  }

  return { stopped: false, paused: false }
}
