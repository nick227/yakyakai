import { Router } from 'express'
import { topicAdjacentShifterPrompt } from '../prompts/topicAdjacentShifterPrompt.js'
import {
  detectUsedZones,
  recommendAdjacentZones,
  truncatePromptTitles,
} from '../services/topicAdjacentShifterService.js'
import { route } from '../lib/route.js'
import { optionalArray, optionalInt, optionalString } from '../lib/validation.js'

export const topicAdjacentRoutes = Router()

topicAdjacentRoutes.post('/diagnose', route(async (req, res) => {
  const prompts = optionalArray(req.body?.prompts, 'prompts', { max: 100 })

  res.json({
    ok: true,
    usedZones: detectUsedZones(prompts),
    suggestedZones: recommendAdjacentZones(prompts),
    avoid: truncatePromptTitles(prompts),
  })
}))

topicAdjacentRoutes.post('/template', route(async (req, res) => {
  const prompts = optionalArray(req.body?.prompts, 'prompts', { max: 100 })
  const originalGoal = optionalString(req.body?.originalGoal, 'originalGoal', { max: 24_000, fallback: '' })
  const count = optionalInt(req.body?.count, 'count', { min: 1, max: 10, fallback: 5 })

  res.json({
    ok: true,
    promptTemplate: topicAdjacentShifterPrompt({
      originalGoal,
      currentPrompts: truncatePromptTitles(prompts),
      count,
    }),
  })
}))
