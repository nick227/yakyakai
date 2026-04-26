import { prisma } from '../db/prisma.js'
import { usageLimits } from '../config/usageLimits.js'
import { countPrompt } from '../utils/tokenEstimate.js'
import { currentMonthWindow } from '../utils/monthWindow.js'
import { contentTooLarge, paymentRequired } from '../lib/httpError.js'

// Per-user in-flight counter — prevents double-spending under concurrent calls
const inFlight = new Map()

function reserveSlot(userId) {
  inFlight.set(userId, (inFlight.get(userId) || 0) + 1)
}

function releaseSlot(userId) {
  const v = (inFlight.get(userId) || 1) - 1
  if (v <= 0) inFlight.delete(userId)
  else inFlight.set(userId, v)
}

// TTL cache for monthly usage — avoids hitting the DB on every concurrent call
const usageCache = new Map()
const CACHE_TTL_MS = 30_000

function invalidateCache(userId) {
  usageCache.delete(userId)
}

export async function getMonthlyUsage(userId) {
  const cached = usageCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) return cached.data

  const { start, end } = currentMonthWindow()

  const aggregate = await prisma.usageLedger.aggregate({
    where: {
      userId,
      createdAt: { gte: start, lt: end },
      status: { in: ['SUCCESS', 'ESTIMATED'] },
    },
    _sum: {
      estimatedPromptTokens: true,
      actualTotalTokens: true,
    },
    _count: { id: true },
  })

  const totalTokens =
    Number(aggregate._sum.actualTotalTokens || 0) ||
    Number(aggregate._sum.estimatedPromptTokens || 0)

  const data = {
    promptsUsed: aggregate._count.id,
    estimatedTokensUsed: totalTokens,
    limits: usageLimits,
  }

  usageCache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS })
  return data
}

export async function assertCanSpendPrompt({ userId, prompt }) {
  const { promptChars, estimatedPromptTokens } = countPrompt(prompt)

  if (promptChars > usageLimits.hardMaxPromptChars) {
    throw contentTooLarge('PROMPT_TOO_LARGE', 'Prompt is too large.')
  }

  const usage = await getMonthlyUsage(userId)
  const pending = inFlight.get(userId) || 0

  if (usage.promptsUsed + pending > usageLimits.freeMonthlyPromptLimit) {
    throw paymentRequired('PROMPT_LIMIT_REACHED', 'Monthly prompt limit reached.')
  }

  if (usage.estimatedTokensUsed + estimatedPromptTokens > usageLimits.freeMonthlyTokenLimit) {
    throw paymentRequired('TOKEN_LIMIT_REACHED', 'Monthly token limit reached.')
  }

  return { promptChars, estimatedPromptTokens, usage }
}

function readProviderUsage(result) {
  const usage = result?.usage || result?.response?.usage || null
  return {
    actualPromptTokens: usage?.prompt_tokens ?? usage?.input_tokens ?? null,
    actualCompletionTokens: usage?.completion_tokens ?? usage?.output_tokens ?? null,
    actualTotalTokens: usage?.total_tokens ?? null,
    model: result?.model || result?.response?.model || null,
  }
}

export async function runAccountedAiCall({
  userId,
  sessionId = null,
  jobId = null,
  phase,
  prompt,
  model = process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  callAi,
}) {
  const startedAt = Date.now()
  reserveSlot(userId)

  try {
    const promptMeta = await assertCanSpendPrompt({ userId, prompt })

    const ledger = await prisma.usageLedger.create({
      data: {
        userId,
        sessionId,
        jobId,
        phase,
        model,
        promptPreview: String(prompt || '').slice(0, 800),
        promptChars: promptMeta.promptChars,
        estimatedPromptTokens: promptMeta.estimatedPromptTokens,
        status: 'STARTED',
      },
    })

    try {
      const result = await callAi()
      const providerUsage = readProviderUsage(result)
      const durationMs = Date.now() - startedAt

      await prisma.usageLedger.update({
        where: { id: ledger.id },
        data: {
          status: providerUsage.actualTotalTokens ? 'SUCCESS' : 'ESTIMATED',
          model: providerUsage.model || model,
          actualPromptTokens: providerUsage.actualPromptTokens,
          actualCompletionTokens: providerUsage.actualCompletionTokens,
          actualTotalTokens: providerUsage.actualTotalTokens,
          durationMs,
        },
      })

      invalidateCache(userId)
      return result
    } catch (error) {
      await prisma.usageLedger.update({
        where: { id: ledger.id },
        data: {
          status: 'FAILED',
          errorCode: error?.code || 'AI_CALL_FAILED',
          errorMessage: String(error?.message || error).slice(0, 1000),
          durationMs: Date.now() - startedAt,
        },
      })

      throw error
    }
  } finally {
    releaseSlot(userId)
  }
}
