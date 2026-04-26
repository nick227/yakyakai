import { prisma } from '../db/prisma.js'
import { logger } from '../lib/logger.js'

export async function publish(sessionId, type, payload = {}) {
  const event = { type, payload, ts: Date.now() }
  await prisma.aiSessionEvent.create({
    data: {
      sessionId,
      type,
      payload: JSON.stringify(event),
    }
  })
  logger.info('Published event to database', { type, sessionId })
}
