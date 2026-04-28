export async function checkPlanState(sessionId, getSessionStatus) {
  const status = await getSessionStatus(sessionId)
  if (status === 'cancelled') return { stopped: true }
  if (status === 'paused') return { paused: true }
  return null
}
