import { Router } from 'express'
import { prisma } from '../db/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { route } from '../lib/route.js'
import { getCredits } from '../services/usageService.js'

export const creditRoutes = Router()

const PACKS = {
  starter: { credits: 100,  label: 'Starter',  priceUsd: 5  },
  pro:     { credits: 500,  label: 'Pro',       priceUsd: 19 },
  power:   { credits: 1500, label: 'Power',     priceUsd: 49 },
}

creditRoutes.get('/', requireAuth, route(async (req, res) => {
  const credits = await getCredits(req.user.id)
  res.json({ ok: true, ...credits, packs: PACKS })
}))

// Stub purchase — grants credits immediately, no payment.
// Replace the prisma.user.update with a Stripe checkout redirect when billing is ready.
creditRoutes.post('/purchase', requireAuth, route(async (req, res) => {
  const packId = req.body?.packId
  const pack = PACKS[packId]
  if (!pack) {
    return res.status(400).json({ ok: false, error: 'INVALID_PACK', message: 'Unknown credit pack.' })
  }

  await prisma.user.update({
    where: { id: req.user.id },
    data: { creditBalance: { increment: pack.credits } },
  })

  const credits = await getCredits(req.user.id)
  res.json({ ok: true, ...credits, purchased: pack })
}))
