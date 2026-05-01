export async function checkPlanState(sessionId, getSessionStatus) {
  const s = await getSessionStatus(sessionId)
  const status = s?.status ?? null
  if (status === 'cancelled') return { stopped: true }
  if (status === 'paused' || status === 'paused_idle') return { paused: true }
  if (s?.isVisible === false) return { paused: true }
  return null
}
