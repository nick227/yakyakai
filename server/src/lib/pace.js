export const PACE_MS = {
  fast:   8_000,
  steady: 18_000,
  deep:   35_000,
}

export const VALID_PACES = Object.keys(PACE_MS)

export function paceMs(pace) {
  return PACE_MS[pace] ?? PACE_MS.steady
}
