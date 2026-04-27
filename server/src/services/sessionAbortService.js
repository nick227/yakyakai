const controllers = new Map()

export function beginSessionAiCall(sessionId) {
  const controller = new AbortController()
  controllers.set(sessionId, controller)
  return controller.signal
}

export function endSessionAiCall(sessionId, signal) {
  const current = controllers.get(sessionId)
  if (current && current.signal === signal) {
    controllers.delete(sessionId)
  }
}

export function abortSessionAiCall(sessionId) {
  const controller = controllers.get(sessionId)
  if (!controller) return false
  controller.abort(new Error('SESSION_ABORTED'))
  controllers.delete(sessionId)
  return true
}

export function isAbortError(error) {
  const message = String(error?.message || '')
  return Boolean(
    error?.name === 'AbortError' ||
    error?.name === 'APIUserAbortError' ||
    error?.code === 'ABORT_ERR' ||
    message.includes('aborted') ||
    message.includes('abort')
  )
}
