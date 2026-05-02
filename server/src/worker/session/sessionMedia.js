import { insertMediaForCycle } from '../../media/insertMediaForCycle.js'
import { callAIRich } from '../../services/openaiClient.js'
import { publishNotice } from '../events.js'

export async function insertCycleMedia(sessionId, cycle, prompt, publish, kind) {
  try {
    const aiGeneratedPrompt = await aiGeneratePrompt(prompt)
    console.log('[media] aiGeneratedPrompt', aiGeneratedPrompt)
    await insertMediaForCycle({ sessionId, cycle, prompt: aiGeneratedPrompt, publish, kind })
  } catch (err) {
    const msg = err?.message || String(err)
    console.error('[media] insertCycleMedia failed', { sessionId, cycle, kind, error: msg })
    await publishNotice(sessionId, `Couldn't add ${kind} media: ${msg}`).catch(() => {})
  }
}

export async function insertAllCycleMedia(sessionId, cycle, prompt, publish) {
  await insertCycleMedia(sessionId, cycle, prompt, publish, 'video')
  await insertCycleMedia(sessionId, cycle, prompt, publish, 'image')
}

async function aiGeneratePrompt(prompt) {
  const response = await callAIRich({
    system: `Write a random creative youtube video search query based on the following prompt: ${prompt}`,
    user: prompt,
  })
  return response.text
}