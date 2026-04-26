import { prisma } from '../db/prisma.js'
import { failJob } from '../services/jobQueueService.js'
import { addJobEvent } from '../services/jobEventService.js'
import { bus } from '../services/bus.js'
import { logger } from '../lib/logger.js'
import { EventTypes } from '../lib/eventTypes.js'
import { runSessionJob } from './sessionRunner.js'

export async function processJob(job, { publish, workerId }) {
  await addJobEvent(job.id, 'started', `Job started by ${workerId}`)
  logger.info('Worker processing job', { jobId: job.id, type: job.type, workerId })

  try {
    switch (job.type) {
      case 'session.start':
      case 'session.cycle':
      case 'run.session':
        await runSessionJob(job, { publish })
        return { completed: true }
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }
  } catch (err) {
    const retriable = job.attempts < job.maxAttempts
    if (retriable) {
      const delayMs = Math.pow(2, job.attempts) * 10_000
      const runAt = new Date(Date.now() + delayMs)
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'queued', lockedAt: null, lockedBy: null, runAt },
      })
      await addJobEvent(job.id, 'retry', `Retry ${job.attempts}/${job.maxAttempts} scheduled`, { runAt: runAt.toISOString() })
      logger.warn('Job will retry', { jobId: job.id, attempt: job.attempts, maxAttempts: job.maxAttempts, runAt })
      return { completed: false }
    }

    if (job.sessionId) {
      await prisma.aiSession.update({ where: { id: job.sessionId }, data: { status: 'failed' } }).catch(() => {})
      await publish(job.sessionId, EventTypes.STATUS, { status: 'failed', error: err.message })
      bus.cleanup(job.sessionId)
    }
    await failJob(job.id, err)
    await addJobEvent(job.id, 'failed', String(err))
    logger.error('Job failed permanently', { jobId: job.id, type: job.type, error: err.message })
    return { completed: false }
  }
}
