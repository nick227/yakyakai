import { insertMediaForCycle } from '../../media/insertMediaForCycle.js'

export async function insertCycleMedia(sessionId, cycle, prompt, publish, kind) {
  await insertMediaForCycle({ sessionId, cycle, prompt, publish, kind })
}

export async function insertAllCycleMedia(sessionId, cycle, prompt, publish) {
  await insertCycleMedia(sessionId, cycle, prompt, publish, 'video')
  await insertCycleMedia(sessionId, cycle, prompt, publish, 'image')
}
