import { prisma } from '../../db/prisma.js'
import { bus } from '../../services/bus.js'
import { EventTypes } from '../../lib/eventTypes.js'
import { titleFromPrompt } from './sessionUtils.js'

export async function updateSessionTitle(sessionId, originalPrompt) {
  const title = titleFromPrompt(originalPrompt)
  if (!title) return
  await prisma.aiSession.update({ where: { id: sessionId }, data: { title } })
}

export async function updateSessionPromptCount(sessionId, count) {
  await prisma.aiSession.update({ where: { id: sessionId }, data: { promptCount: count } })
}

export async function updateSessionCurrentPrompt(sessionId, prompt) {
  await prisma.aiSession.update({ where: { id: sessionId }, data: { currentPrompt: prompt } })
}

export async function updateSessionStatus(sessionId, status) {
  await prisma.aiSession.update({ where: { id: sessionId }, data: { status } })
}

export async function updateSessionCycleCount(sessionId, cycle, nextEligibleAt) {
  await prisma.aiSession.update({
    where: { id: sessionId },
    data: { cycleCount: cycle, nextEligibleAt }
  })
}

export async function completeSession(sessionId, cycle, publish) {
  await prisma.aiSession.update({ where: { id: sessionId }, data: { cycleCount: cycle, status: 'completed' } })
  await publish(sessionId, EventTypes.STATUS, { status: 'completed', cycle })
  bus.cleanup(sessionId)
}

export async function updateSessionFirstCycle(sessionId, originalPrompt, promptCount, currentPrompt) {
  const updates = { promptCount, currentPrompt }
  if (!originalPrompt || !titleFromPrompt(originalPrompt)) {
    updates.title = titleFromPrompt(originalPrompt)
  }
  await prisma.aiSession.update({ where: { id: sessionId }, data: updates })
}

export async function updateSessionRestartCycle(sessionId, restartInstruction, promptCount) {
  await prisma.aiSession.update({
    where: { id: sessionId },
    data: { currentPrompt: restartInstruction, promptCount }
  })
}
