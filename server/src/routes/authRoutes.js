import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../db/prisma.js'
import { clearAuthCookie, requireAuth, setAuthCookie, signUserToken } from '../middleware/auth.js'
import { sendResetEmail } from '../lib/mailer.js'
import { route } from '../lib/route.js'
import { requireEmail, requirePassword, optionalString } from '../lib/validation.js'
import { badRequest, conflict, unauthorized } from '../lib/httpError.js'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex')

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
    avatarUrl: user.avatarUrl,
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
  if (!user.passwordHash) throw unauthorized('USE_GOOGLE', 'This account uses Google sign-in.')

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) throw unauthorized('INVALID_LOGIN', 'Invalid email or password.')

  setAuthCookie(res, signUserToken(user))
  res.json({ ok: true, user: publicUser(user) })
}))

authRoutes.post('/google', authLimiter, route(async (req, res) => {
  const credential = String(req.body?.credential || '')
  if (!credential) throw badRequest('MISSING_CREDENTIAL', 'Google credential is required.')

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  })
  const { sub: googleId, email, name, picture: avatarUrl } = ticket.getPayload()

  let user = await prisma.user.findUnique({ where: { googleId } })

  if (!user) {
    // Link to an existing email/password account if the email matches
    const byEmail = await prisma.user.findUnique({ where: { email } })
    if (byEmail) {
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId, avatarUrl: avatarUrl || byEmail.avatarUrl },
      })
    } else {
      user = await prisma.user.create({
        data: { googleId, email, name: name || null, avatarUrl: avatarUrl || null, plan: 'FREE', role: 'USER' },
      })
    }
  } else if (avatarUrl && user.avatarUrl !== avatarUrl) {
    user = await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } })
  }

  setAuthCookie(res, signUserToken(user))
  res.json({ ok: true, user: publicUser(user) })
}))

authRoutes.post('/forgot-password', authLimiter, route(async (req, res) => {
  const email = requireEmail(req.body?.email)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })

  if (user) {
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashToken(token), resetTokenAt: new Date(Date.now() + 3600_000) },
    })
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'
    await sendResetEmail(email, `${origin}/?token=${token}`)
  }

  // Always respond OK — never reveal whether email exists
  res.json({ ok: true })
}))

authRoutes.post('/reset-password', authLimiter, route(async (req, res) => {
  const token = String(req.body?.token || '')
  const password = requirePassword(req.body?.password)

  const user = await prisma.user.findFirst({
    where: { resetToken: hashToken(token), resetTokenAt: { gt: new Date() } },
  })
  if (!user) throw unauthorized('INVALID_TOKEN', 'Reset link is invalid or has expired.')

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 12), resetToken: null, resetTokenAt: null },
  })
  res.json({ ok: true })
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
