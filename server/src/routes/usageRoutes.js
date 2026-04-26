import { Router } from 'express'
import { prisma } from '../db/prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { currentMonthWindow } from '../utils/monthWindow.js'
import { usageLimits } from '../config/usageLimits.js'
import { route } from '../lib/route.js'

export const usageRoutes = Router()

usageRoutes.get('/me', requireAuth, route(async (req, res) => {
  const { start, end } = currentMonthWindow()

  const aggregate = await prisma.usageLedger.aggregate({
    where: {
      userId: req.user.id,
      createdAt: { gte: start, lt: end },
      status: { in: ['SUCCESS', 'ESTIMATED'] },
    },
    _sum: {
      estimatedPromptTokens: true,
      actualTotalTokens: true,
    },
    _count: { id: true },
  })

  const estimatedTokensUsed =
    Number(aggregate._sum.actualTotalTokens || 0) ||
    Number(aggregate._sum.estimatedPromptTokens || 0)

  res.json({
    ok: true,
    window: { start, end },
    promptsUsed: aggregate._count.id,
    estimatedTokensUsed,
    limits: {
      monthlyPromptLimit: usageLimits.freeMonthlyPromptLimit,
      monthlyTokenLimit: usageLimits.freeMonthlyTokenLimit,
    },
    remaining: {
      prompts: Math.max(0, usageLimits.freeMonthlyPromptLimit - aggregate._count.id),
      estimatedTokens: Math.max(0, usageLimits.freeMonthlyTokenLimit - estimatedTokensUsed),
    },
  })
}))
