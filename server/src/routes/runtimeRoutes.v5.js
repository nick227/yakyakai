import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { route } from '../lib/route.js'
import { createRuntimeState } from '../services/runtimeStateService.js'
import { createInitialBatch } from '../services/plannerV5Service.js'
import { createShiftBatch } from '../services/shifterV5Service.js'
import { requireString } from '../lib/validation.js'

export const runtimeRoutesV5 = Router()

/**
 * @swagger
 * /api/runtime/start:
 *   post:
 *     summary: Start runtime state for a session
 *     tags: [Runtime]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt:
 *                 type: string
 *                 maxLength: 24000
 *     responses:
 *       200:
 *         description: Runtime state created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 state:
 *                   type: object
 *                 batch:
 *                   type: array
 *       401:
 *         description: Unauthorized
 */
runtimeRoutesV5.post('/start', requireAuth, route(async (req,res)=>{
 const prompt = requireString(req.body?.prompt, 'prompt', { max: 24_000 })
 const state = createRuntimeState({originalPrompt:prompt})
 res.json({ok:true,state,batch:createInitialBatch(prompt)})
}))

/**
 * @swagger
 * /api/runtime/shift:
 *   post:
 *     summary: Generate shift batch from runtime state
 *     tags: [Runtime]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Shift batch generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 batch:
 *                   type: array
 *       401:
 *         description: Unauthorized
 */
runtimeRoutesV5.post('/shift', requireAuth, route(async (req,res)=>{
 const state = req.body || {}
 res.json({ok:true,batch:createShiftBatch(state)})
}))
