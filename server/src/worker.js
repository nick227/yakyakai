import 'dotenv/config'
import { logger } from './lib/logger.js'
import { WORKER_ID } from './worker/constants.js'
import { publish } from './worker/events.js'
import { startLoop } from './worker/loop.js'

let shuttingDown = false
let activeJobRunning = false

function onShutdown() {
  shuttingDown = true
  logger.info('Worker shutdown signal received', { workerId: WORKER_ID })
  if (!activeJobRunning) process.exit(0)
}

process.on('SIGTERM', onShutdown)
process.on('SIGINT', onShutdown)

startLoop({
  workerId: WORKER_ID,
  publish,
  shouldStop: () => shuttingDown,
  setActive: (value) => {
    activeJobRunning = value
    if (!value && shuttingDown) process.exit(0)
  },
}).then(() => process.exit(0)).catch((err) => {
  logger.error('Worker fatal error', { error: err.message })
  process.exit(1)
})
