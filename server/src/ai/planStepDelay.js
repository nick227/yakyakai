const STEP_DELAY_BY_PACE_MS = {
  fast: 0,
  steady: 1200,
  deep: 3000,
  safe: 5000,
}

export function getPlanDelay(pace) {
  const key = pace != null && STEP_DELAY_BY_PACE_MS[pace] !== undefined ? pace : 'steady'
  return STEP_DELAY_BY_PACE_MS[key] ?? STEP_DELAY_BY_PACE_MS.steady
}

function readStepDelayEnvOverride() {
  const raw = process.env.PLAN_STEP_DELAY_MS ?? process.env.AI_QUEUE_SPACING_MS
  if (raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
}

export function getEffectivePlanStepDelayMs(session) {
  const override = readStepDelayEnvOverride()
  if (override !== null) return override
  return getPlanDelay(session?.pace)
}
