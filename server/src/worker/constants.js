import { usageLimits } from '../config/usageLimits.js'

export const WORKER_ID = process.env.WORKER_ID || 'worker-main'
export const PROMPT_COUNT = Math.min(
  usageLimits.hardMaxPlannerTasks,
  Number(process.env.MAX_PROMPTS_PER_CYCLE || 6)
)
export const MAX_CYCLES = Number(process.env.MAX_CYCLES || 1000)
export const PROCESS_CONCURRENCY = Number(process.env.PROCESS_CONCURRENCY || 2)

export const PLAN_TOOL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prompts: {
      type: 'array',
      minItems: 1,
      maxItems: Math.max(1, PROMPT_COUNT),
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          prompt: { type: 'string' },
        },
        required: ['prompt'],
      },
    },
  },
  required: ['prompts'],
}
