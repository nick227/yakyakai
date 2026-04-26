import { claimNextJob, completeJob } from '../services/jobQueueService.js'
import { addJobEvent } from '../services/jobEventService.js'
import { logger } from '../lib/logger.js'
import { processJob } from './jobProcessor.js'
import { runWatchdog } from './watchdog.js'

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function startLoop({ workerId, publish, shouldStop, setActive }) {
  let lastWatchdog = 0
  logger.info('Worker started', { workerId })

  while (!shouldStop()) {
    try {
      if (Date.now() - lastWatchdog > 30_000) {
        lastWatchdog = Date.now()
        try {
          await runWatchdog()
        } catch (err) {
          logger.warn('Watchdog error', { error: err.message })
        }
      }

      const job = await claimNextJob(workerId)
      if (!job) {
        await wait(600)
        continue
      }

      setActive(true)
      const result = await processJob(job, { publish, workerId })
      if (result.completed) {
        await completeJob(job.id)
        await addJobEvent(job.id, 'complete', 'Job completed')
        logger.info('Job completed', { jobId: job.id, type: job.type })
      }
    } catch (err) {
      logger.error('Worker loop error', { error: err.message })
      await wait(1000)
    } finally {
      setActive(false)
    }
  }
}
