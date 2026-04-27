import { prisma } from '../db/prisma.js'

export async function enqueueJob({
  userId = null,
  sessionId = null,
  type = 'run.session',
  priority = 0,
  payload = {},
  runAt = null,
}) {
  return prisma.job.create({
    data: {
      userId,
      sessionId,
      type,
      priority,
      payloadJson: JSON.stringify(payload),
      ...(runAt && { runAt }),
    },
  })
}

export async function claimNextJob(workerId = 'worker-1') {
  const now = new Date()

  // Only claim jobs for sessions that are currently visible (tab open + not paused)
  // Non-session jobs (sessionId null) are always eligible
  const candidate = await prisma.job.findFirst({
    where: {
      status: 'queued',
      runAt: { lte: now },
      OR: [
        { sessionId: null },
        { session: { isVisible: true } },
      ],
    },
    orderBy: [{ priority: 'desc' }, { runAt: 'asc' }],
    select: { id: true, sessionId: true, session: { select: { isVisible: true } } },
  })

  if (!candidate) {
    console.log('[jobQueue] No eligible jobs found', { workerId, now })
    return null
  }

  console.log('[jobQueue] Found candidate job', { jobId: candidate.id, sessionId: candidate.sessionId, isVisible: candidate.session?.isVisible })

  // Atomic claim — only succeeds if still queued
  const claimed = await prisma.job.updateMany({
    where: { id: candidate.id, status: 'queued' },
    data: {
      status: 'running',
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 },
    },
  })

  if (claimed.count === 0) {
    console.log('[jobQueue] Job claim failed (race condition)', { jobId: candidate.id })
    return null
  }

  console.log('[jobQueue] Job claimed successfully', { jobId: candidate.id, workerId })
  return prisma.job.findUnique({ where: { id: candidate.id } })
}

export async function completeJob(id) {
  return prisma.job.update({
    where: { id },
    data: { status: 'complete', progress: 100 },
  })
}

export async function failJob(id, error) {
  return prisma.job.update({
    where: { id },
    data: { status: 'failed', lastError: String(error).slice(0, 1000) },
  })
}

export async function pauseJob(id) {
  return prisma.job.update({ where: { id }, data: { status: 'paused' } })
}

export async function resumeJob(id) {
  return prisma.job.update({
    where: { id },
    data: { status: 'queued', lockedAt: null, lockedBy: null },
  })
}
