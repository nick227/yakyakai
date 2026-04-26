import { prisma } from '../db/prisma.js'
import { runGoverned } from '../services/aiGovernor.js'
import { runAccountedAiCall } from '../services/usageService.js'
import { callAIRich } from '../services/openaiClient.js'
import { EventTypes } from '../lib/eventTypes.js'
import { PROCESS_CONCURRENCY } from './constants.js'
import { buildProcessPriorContext, chunkItems } from './context.js'
import { buildProcessPrompt } from './prompts.js'

export async function processPrompts({
  session,
  sessionId,
  job,
  currentCycle,
  plan,
  publish,
  addJobEvent,
  isCancelled,
}) {
  const priorHtml = []
  const promptEntries = plan.prompts.map((item, index) => ({ item, index }))

  for (const batch of chunkItems(promptEntries, PROCESS_CONCURRENCY)) {
    if (await isCancelled(sessionId)) return { stopped: true }

    const priorContext = buildProcessPriorContext(priorHtml)
    for (const { index } of batch) {
      await publish(sessionId, EventTypes.PROMPT_START, { index, cycle: currentCycle })
    }

    const wordLimit = session.pace === 'fast' ? 150 : session.pace === 'deep' ? 350 : 220
    const batchResults = await Promise.all(batch.map(async ({ item, index }) => {
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
      return { index, html: outputResult.text }
    }))

    for (const result of batchResults.sort((a, b) => a.index - b.index)) {
      priorHtml.push(result.html)
      await prisma.aiOutput.create({
        data: {
          sessionId,
          cycle: currentCycle,
          index: result.index,
          title: '_',
          html: result.html
        }
      })
      await prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'ASSISTANT',
          content: result.html,
          metadata: JSON.stringify({ cycle: currentCycle, index: result.index }),
        },
      })
      await publish(sessionId, EventTypes.OUTPUT, { index: result.index, html: result.html, cycle: currentCycle })
      await addJobEvent(job.id, 'output', `Cycle ${currentCycle} prompt ${result.index + 1}/${plan.prompts.length} done`)
    }
  }

  return { stopped: false }
}
