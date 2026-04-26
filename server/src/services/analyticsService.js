import { prisma } from '../db/prisma.js'

export async function trackRunEvent({ userId=null, sessionId=null, eventType, value=null, meta={} }) {
  return prisma.runAnalytics.create({
    data: {
      userId,
      sessionId,
      eventType,
      value,
      metaJson: JSON.stringify(meta || {})
    }
  })
}

export async function getUserDashboardStats(userId) {
  const [runs, saved, analytics] = await Promise.all([
    prisma.aiSession.findMany({
      where: { userId },
      orderBy: { createdAt:'desc' },
      take: 20
    }),
    prisma.savedOutput.findMany({
      where: { userId },
      orderBy: { createdAt:'desc' },
      take: 20
    }),
    prisma.runAnalytics.groupBy({
      by: ['eventType'],
      where: { userId },
      _count: { eventType: true }
    })
  ])

  return { runs, saved, analytics }
}
