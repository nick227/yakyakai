import { prisma } from '../db/prisma.js'
import { logger } from '../lib/logger.js'
import { EventTypes } from '../lib/eventTypes.js'

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

export async function publishNotice(sessionId, message) {
  const savedMsg = await prisma.chatMessage.create({
    data: {
      sessionId,
      role: 'ASSISTANT',
      content: message,
      metadata: JSON.stringify({ isNotice: true }),
    },
  })
  await publish(sessionId, EventTypes.NOTICE, {
    message,
    messageId: savedMsg.id,
    createdAt: savedMsg.createdAt.toISOString(),
  })
}
