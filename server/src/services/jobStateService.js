import { prisma } from '../db/prisma.js'
import { conflict, notFound } from '../lib/httpError.js'
import { addJobEvent } from './jobEventService.js'

const transitions = {
  queued: ['running', 'paused', 'cancelled'],
  running: ['paused', 'complete', 'failed', 'cancelled'],
  paused: ['queued', 'cancelled'],
  complete: [],
  failed: ['queued'],
  cancelled: [],
}

export function canTransition(from, to) {
  return Boolean(transitions[from]?.includes(to))
}

export async function transitionJob({ jobId, to, actor='system', message='' }) {
  const job = await prisma.job.findUnique({ where: { id: jobId } })
  if (!job) throw notFound('JOB_NOT_FOUND', 'Job not found.')

  if (job.status === to) return job

  if (!canTransition(job.status, to)) {
    throw conflict('INVALID_JOB_TRANSITION', `Cannot move job from ${job.status} to ${to}.`, {
      from: job.status,
      to,
    })
  }

  const data = { status: to }

  if (to === 'queued') {
    data.lockedAt = null
    data.lockedBy = null
  }

  if (to === 'cancelled' || to === 'failed' || to === 'complete') {
    data.lockedAt = null
    data.lockedBy = null
  }

  const updated = await prisma.job.update({ where: { id: jobId }, data })
  await addJobEvent(jobId, `job_${to}`, message || `Job moved to ${to}.`, { actor, from: job.status, to })

  return updated
}

export async function cancelJob(jobId, actor='user') {
  return transitionJob({ jobId, to: 'cancelled', actor, message: 'Job cancelled.' })
}

export async function pauseJobSafe(jobId, actor='user') {
  return transitionJob({ jobId, to: 'paused', actor, message: 'Job paused.' })
}

export async function resumeJobSafe(jobId, actor='user') {
  return transitionJob({ jobId, to: 'queued', actor, message: 'Job resumed.' })
}
