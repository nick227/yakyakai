import { useCallback, useEffect, useState } from 'react'

const CUID_RE = /^[a-z][a-z0-9]{20,30}$/
function getSessionIdFromUrl() {
  const segment = window.location.pathname.split('/').filter(Boolean)[0]
  return segment && CUID_RE.test(segment) ? segment : null
}

export function useSessionRouter() {
  // URL is canonical. Root (/) should always be a clean load.
  const [sessionId, setSessionId] = useState(() => getSessionIdFromUrl())

  // Push/replace URL when sessionId changes programmatically
  const navigateTo = useCallback((id) => {
    const target = id ? '/' + id : '/'
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target)
    }
    setSessionId(id)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => {
      const id = getSessionIdFromUrl()
      setSessionId(id)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const clearStaleSession = useCallback(() => {
    const hadUrlSession = Boolean(getSessionIdFromUrl())
    window.history.replaceState({}, '', '/')
    setSessionId(null)
    return hadUrlSession
  }, [])

  return {
    sessionId,
    navigateTo,
    clearStaleSession,
  }
}
