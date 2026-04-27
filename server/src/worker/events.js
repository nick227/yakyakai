import { prisma } from '../db/prisma.js'
import { logger } from '../lib/logger.js'

export async function publish(sessionId, type, payload = {}) {
  const event = { type, payload, ts: Date.now() }
  logger.info('[events] Publishing to database', { type, sessionId, payload })
  await prisma.aiSessionEvent.create({
    data: {
      sessionId,
      type,
      payload: JSON.stringify(event),
    }
  })
  logger.info('[events] Published event to database successfully', { type, sessionId })
}
