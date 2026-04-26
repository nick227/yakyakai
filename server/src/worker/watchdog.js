import { prisma } from '../db/prisma.js'
import { logger } from '../lib/logger.js'

let watchdogRunning = false

export async function runWatchdog() {
  if (watchdogRunning) return
  watchdogRunning = true
  try {
    const staleTimeoutMs = Number(process.env.WATCHDOG_STALE_TIMEOUT_MS || 120_000)
    const staleAt = new Date(Date.now() - staleTimeoutMs)
    const { count } = await prisma.aiSession.updateMany({
      where: {
        isVisible: true,
        lastHeartbeatAt: { not: null, lt: staleAt },
        status: { notIn: ['cancelled', 'completed', 'failed'] },
      },
      data: { isVisible: false },
    })
    if (count > 0) logger.info('Watchdog expired stale sessions', { count })
  } finally {
    watchdogRunning = false
  }
}
