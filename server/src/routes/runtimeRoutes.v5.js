import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { route } from '../lib/route.js'
import { createRuntimeState } from '../services/runtimeStateService.js'
import { createInitialBatch } from '../services/plannerV5Service.js'
import { createShiftBatch } from '../services/shifterV5Service.js'
import { requireString } from '../lib/validation.js'

export const runtimeRoutesV5 = Router()

runtimeRoutesV5.post('/start', requireAuth, route(async (req,res)=>{
 const prompt = requireString(req.body?.prompt, 'prompt', { max: 24_000 })
 const state = createRuntimeState({originalPrompt:prompt})
 res.json({ok:true,state,batch:createInitialBatch(prompt)})
}))

runtimeRoutesV5.post('/shift', requireAuth, route(async (req,res)=>{
 const state = req.body || {}
 res.json({ok:true,batch:createShiftBatch(state)})
}))
