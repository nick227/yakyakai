import { Router } from 'express'
import { analyzePromptShape, savePromptAnalysis } from '../services/promptIntelligenceService.js'
import { decideNextRunAction, scoreOutput } from '../services/adaptiveRunService.js'
import { requireAuth } from '../middleware/auth.js'
import { route } from '../lib/route.js'
import { optionalArray, optionalInt, optionalString, requireString } from '../lib/validation.js'

export const intelligenceRoutes = Router()

intelligenceRoutes.post('/analyze-prompt', requireAuth, route(async (req, res) => {
  const prompt = requireString(req.body?.prompt, 'prompt', { max: 24_000 })
  const siblingPrompts = optionalArray(req.body?.siblingPrompts, 'siblingPrompts', { max: 50 })
  const analysis = analyzePromptShape(prompt, siblingPrompts)
  res.json({ ok: true, analysis })
}))

intelligenceRoutes.post('/save-prompt-analysis', requireAuth, route(async (req, res) => {
  const record = await savePromptAnalysis({
    userId: req.user.id,
    sessionId: optionalString(req.body?.sessionId, 'sessionId', { max: 128, fallback: null }) || null,
    prompt: requireString(req.body?.prompt, 'prompt', { max: 24_000 }),
    siblingPrompts: optionalArray(req.body?.siblingPrompts, 'siblingPrompts', { max: 50 }),
  })
  res.json({ ok: true, record })
}))

intelligenceRoutes.post('/score-output', requireAuth, route(async (req, res) => {
  const output = requireString(req.body?.output, 'output', { min: 0, max: 80_000 })
  res.json({ ok: true, score: scoreOutput(output) })
}))

intelligenceRoutes.post('/decide-next', requireAuth, route(async (req, res) => {
  const decision = decideNextRunAction({
    currentIndex: optionalInt(req.body?.currentIndex, 'currentIndex', { min: 0, max: 1000, fallback: 0 }),
    totalPrompts: optionalInt(req.body?.totalPrompts, 'totalPrompts', { min: 0, max: 1000, fallback: 0 }),
    recentScores: optionalArray(req.body?.recentScores, 'recentScores', { max: 50 }),
    maxPrompts: optionalInt(req.body?.maxPrompts, 'maxPrompts', { min: 1, max: 100, fallback: 10 }),
  })
  res.json({ ok: true, decision })
}))
