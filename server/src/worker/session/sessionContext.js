import { prisma } from '../../db/prisma.js'

function parseJobPayload(payloadJson) {
  if (!payloadJson) return {}
  try {
    return JSON.parse(payloadJson)
  } catch {
    return {}
  }
}

async function getSessionStatus(sessionId) {
  return prisma.aiSession.findUnique({ where: { id: sessionId }, select: { status: true, isVisible: true } })
}

export function buildCycleContext(session, job, publish) {
  const payload = parseJobPayload(job.payloadJson)
  const restartInstruction = String(payload.restartPrompt || '').trim()
  const restartSourcePrompt = String(payload.restartSourcePrompt || '').trim()
  const hasRestartContext = Boolean(restartInstruction && restartSourcePrompt)
  const cycle = session.cycleCount ?? 0

  const cycleCtx = {
    session,
    sessionId: job.sessionId,
    jobId: job.id,
    job,
    publish,
    cycle,
    phase: null,
    plan: null,
    outputs: null,
    restartInstruction,
    previousPrompt: restartSourcePrompt,
    currentPrompt: session.currentPrompt || session.originalPrompt,
    hasRestartContext
  }

  Object.seal(cycleCtx)
  return cycleCtx
}

export { getSessionStatus }
