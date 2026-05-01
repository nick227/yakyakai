export const PACE_MS = {
  fast:   4_000,
  steady: 18_000,
  deep:   35_000,
}

export const DEFAULT_PACE = process.env.DEFAULT_PACE || 'fast'
export const VALID_PACES = Object.keys(PACE_MS)

export function paceMs(pace) {
  return PACE_MS[pace] ?? PACE_MS[DEFAULT_PACE] ?? PACE_MS.fast
}
