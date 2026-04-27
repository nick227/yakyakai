import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { plannerPromptV36 } from '../prompts/plannerPrompt.v3_6.js'
import { refinePlannerTasks } from '../services/plannerQualityService.js'
import { route } from '../lib/route.js'
import { optionalArray, optionalString } from '../lib/validation.js'

export const plannerRoutesV36 = Router()

/**
 * @swagger
 * /api/planner/diagnose:
 *   post:
 *     summary: Diagnose and refine planner tasks
 *     tags: [Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tasks:
 *                 type: array
 *                 maxItems: 50
 *     responses:
 *       200:
 *         description: Tasks diagnosed and refined
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 tasks:
 *                   type: array
 *       401:
 *         description: Unauthorized
 */
plannerRoutesV36.post('/diagnose', requireAuth, route(async (req, res) => {
  const tasks = optionalArray(req.body?.tasks, 'tasks', { max: 50 })
  res.json({ ok: true, tasks: refinePlannerTasks(tasks) })
}))

/**
 * @swagger
 * /api/planner/template:
 *   post:
 *     summary: Generate planner prompt template
 *     tags: [Planner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               prompt:
 *                 type: string
 *                 maxLength: 24000
 *     responses:
 *       200:
 *         description: Prompt template generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 promptTemplate:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
plannerRoutesV36.post('/template', requireAuth, route(async (req, res) => {
  const userPrompt = optionalString(req.body?.prompt, 'prompt', {
    max: 24_000,
    fallback: 'example request',
  })

  res.json({ ok: true, promptTemplate: plannerPromptV36(userPrompt) })
}))
