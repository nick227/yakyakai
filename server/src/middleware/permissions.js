import { forbidden, unauthorized } from '../lib/httpError.js'
import { prisma } from '../db/prisma.js'

export function requireRole(role) {
  return function roleMiddleware(req, _res, next) {
    if (!req.user?.id) return next(unauthorized())
    if (req.user.role !== role) return next(forbidden('ROLE_REQUIRED', `${role} role required.`))
    next()
  }
}

export const requireAdmin = requireRole('ADMIN')

export async function assertOwnsSession(userId, sessionId) {
  if (!userId) throw unauthorized()
  const session = await prisma.aiSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, userId: true, status: true },
  })
  if (!session) throw forbidden('SESSION_ACCESS_DENIED', 'You do not have access to this session.')
  return session
}

export async function assertOwnsJob(userId, jobId) {
  if (!userId) throw unauthorized()
  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { id: true, userId: true, sessionId: true, status: true },
  })
  if (!job) throw forbidden('JOB_ACCESS_DENIED', 'You do not have access to this job.')
  return job
}

export function canReadSession(user, session) {
  return session.isVisible || session.userId === user?.id
}

export function canWriteSession(user, session) {
  return user && session.userId === user.id
}
