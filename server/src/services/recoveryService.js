import { prisma } from '../db/prisma.js'
import { addJobEvent } from './jobEventService.js'

export async function recoverStuckJobs({ olderThanMinutes=10 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000)

  const stuck = await prisma.job.findMany({
    where: {
      status: 'running',
      lockedAt: { lt: cutoff }
    },
    take: 50
  })

  const recovered = []

  for (const job of stuck) {
    if (job.attempts >= job.maxAttempts) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          lastError: 'Recovered as failed after max attempts.'
        }
      })
      await addJobEvent(job.id, 'recovery_failed', 'Marked failed after max attempts.')
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'queued',
          lockedAt: null,
          lockedBy: null,
          lastError: 'Recovered from stale running lock.'
        }
      })
      await addJobEvent(job.id, 'recovered', 'Requeued stale running job.')
    }

    recovered.push(job.id)
  }

  return { count: recovered.length, recovered }
}
