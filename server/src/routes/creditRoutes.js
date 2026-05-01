import { Router } from 'express'
import Stripe from 'stripe'
import { prisma } from '../db/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { route } from '../lib/route.js'
import { getCredits } from '../services/usageService.js'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

export const creditRoutes = Router()

const CREDITS_PER_TOKEN = Number(process.env.CREDITS_PER_TOKEN) || 1000

const PACKS = {
  starter: { credits: 100000, label: 'Starter',  priceUsd: 5  },
  pro:     { credits: 500000, label: 'Pro',       priceUsd: 19 },
  power:   { credits: 1500000, label: 'Power',     priceUsd: 49 },
}

function requireStripe(res) {
  if (stripe) return true
  return res.status(503).json({
    ok: false,
    error: 'STRIPE_NOT_CONFIGURED',
    message: 'Stripe is not configured on this server.',
  })
}

creditRoutes.get('/', requireAuth, route(async (req, res) => {
  const credits = await getCredits(req.user.id)
  res.json({ ok: true, ...credits, packs: PACKS })
}))

creditRoutes.post('/purchase', requireAuth, route(async (req, res) => {
  if (!requireStripe(res)) return

  const packId = req.body?.packId
  const pack = PACKS[packId]
  if (!pack) {
    return res.status(400).json({ ok: false, error: 'INVALID_PACK', message: 'Unknown credit pack.' })
  }

  // Create pending transaction record
  const transaction = await prisma.creditTransaction.create({
    data: {
      userId: req.user.id,
      amount: pack.credits,
      packId,
      amountUsd: pack.priceUsd * 100, // Stripe uses cents
      status: 'PENDING',
    },
  })

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${pack.label} Token Pack`,
            description: `${pack.credits.toLocaleString()} tokens`,
          },
          unit_amount: pack.priceUsd * 100,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.CLIENT_ORIGIN}/?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_ORIGIN}/?purchase=cancelled`,
    metadata: {
      transactionId: transaction.id,
      userId: req.user.id,
      packId,
    },
  })

  // Update transaction with Stripe session ID
  await prisma.creditTransaction.update({
    where: { id: transaction.id },
    data: { stripeSessionId: session.id },
  })

  res.json({ ok: true, checkoutUrl: session.url })
}))

creditRoutes.post('/webhook', route(async (req, res) => {
  if (!requireStripe(res)) return

  const sig = req.headers['stripe-signature']
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  if (webhookSecret) {
    // Production: verify signature
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return res.status(400).json({ error: 'Invalid signature' })
    }
  } else {
    // Development: skip verification (localhost can't receive real webhooks)
    console.warn('STRIPE_WEBHOOK_SECRET not configured - skipping signature verification (dev mode)')
    event = req.body
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { transactionId, userId, packId } = session.metadata

    if (!transactionId || !userId) {
      console.error('Missing metadata in webhook:', session.metadata)
      return res.status(400).json({ error: 'Invalid metadata' })
    }

    // Update transaction and grant credits
    const transaction = await prisma.creditTransaction.findUnique({
      where: { id: transactionId },
    })

    if (!transaction) {
      console.error('Transaction not found:', transactionId)
      return res.status(404).json({ error: 'Transaction not found' })
    }

    if (transaction.status === 'COMPLETED') {
      // Already processed, idempotent
      return res.json({ received: true })
    }

    const pack = PACKS[packId]
    if (!pack) {
      console.error('Invalid packId in webhook:', packId)
      return res.status(400).json({ error: 'Invalid pack' })
    }

    await prisma.$transaction([
      prisma.creditTransaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { creditBalance: { increment: pack.credits } },
      }),
    ])

    console.log(`Credits granted: ${pack.credits} to user ${userId}`)
  }

  res.json({ received: true })
}))

// Temporary endpoint for testing - adds free credits without Stripe
creditRoutes.post('/free-credits', requireAuth, route(async (req, res) => {
  const amount = Number(req.body?.amount) || 100000

  await prisma.$transaction([
    prisma.creditTransaction.create({
      data: {
        userId: req.user.id,
        amount,
        packId: 'free_test',
        amountUsd: 0,
        status: 'COMPLETED',
      },
    }),
    prisma.user.update({
      where: { id: req.user.id },
      data: { creditBalance: { increment: amount } },
    }),
  ])

  console.log(`Free credits granted: ${amount} to user ${req.user.id}`)
  res.json({ ok: true, amount })
}))
