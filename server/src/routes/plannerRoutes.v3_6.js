import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { plannerPromptV36 } from '../prompts/plannerPrompt.v3_6.js'
import { refinePlannerTasks } from '../services/plannerQualityService.js'
import { route } from '../lib/route.js'
import { optionalArray, optionalString } from '../lib/validation.js'

export const plannerRoutesV36 = Router()

plannerRoutesV36.post('/diagnose', requireAuth, route(async (req, res) => {
  const tasks = optionalArray(req.body?.tasks, 'tasks', { max: 50 })
  res.json({ ok: true, tasks: refinePlannerTasks(tasks) })
}))

plannerRoutesV36.post('/template', requireAuth, route(async (req, res) => {
  const userPrompt = optionalString(req.body?.prompt, 'prompt', {
    max: 24_000,
    fallback: 'example request',
  })

  res.json({ ok: true, promptTemplate: plannerPromptV36(userPrompt) })
}))
