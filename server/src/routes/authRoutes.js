import bcrypt from 'bcryptjs'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { prisma } from '../db/prisma.js'
import { clearAuthCookie, requireAuth, setAuthCookie, signUserToken } from '../middleware/auth.js'
import { route } from '../lib/route.js'
import { requireEmail, requirePassword, optionalString } from '../lib/validation.js'
import { conflict, unauthorized } from '../lib/httpError.js'

export const authRoutes = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' },
})

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    plan: user.plan,
    createdAt: user.createdAt,
  }
}

authRoutes.post('/register', authLimiter, route(async (req, res) => {
  const email = requireEmail(req.body?.email)
  const password = requirePassword(req.body?.password)
  const name = optionalString(req.body?.name, 'name', { max: 120, fallback: null }) || null

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) throw conflict('EMAIL_EXISTS', 'That email is already registered.')

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: { email, name, passwordHash, plan: 'FREE', role: 'USER' },
  })

  setAuthCookie(res, signUserToken(user))
  res.status(201).json({ ok: true, user: publicUser(user) })
}))

authRoutes.post('/login', authLimiter, route(async (req, res) => {
  const email = requireEmail(req.body?.email)
  const password = String(req.body?.password || '')

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw unauthorized('INVALID_LOGIN', 'Invalid email or password.')

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) throw unauthorized('INVALID_LOGIN', 'Invalid email or password.')

  setAuthCookie(res, signUserToken(user))
  res.json({ ok: true, user: publicUser(user) })
}))

authRoutes.post('/logout', requireAuth, route(async (_req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
}))

authRoutes.get('/me', requireAuth, route(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user) throw unauthorized()
  res.json({ ok: true, user: publicUser(user) })
}))
