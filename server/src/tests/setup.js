import { prisma } from '../db/prisma.js'

export async function cleanupDatabase() {
  await prisma.chatMessage.deleteMany()
  await prisma.aiSessionEvent.deleteMany()
  await prisma.aiSession.deleteMany()
  await prisma.job.deleteMany()
  await prisma.user.deleteMany()
}
