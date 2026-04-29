import { useCallback, useEffect, useState } from 'react'

const CUID_RE = /^[a-z][a-z0-9]{20,30}$/
function getSessionIdFromUrl() {
  const segment = window.location.pathname.split('/').filter(Boolean)[0]
  return segment && CUID_RE.test(segment) ? segment : null
}

function isProfileRoute() {
  return window.location.pathname === '/profile'
}

function isPublicRoute() {
  return window.location.pathname === '/public'
}

export function useSessionRouter() {
  // URL is canonical. Root (/) should always be a clean load.
  const [sessionId, setSessionId] = useState(() => getSessionIdFromUrl())
  const [isProfile, setIsProfile] = useState(() => isProfileRoute())
  const [isPublic, setIsPublic] = useState(() => isPublicRoute())

  // Push/replace URL when sessionId changes programmatically
  const navigateTo = useCallback((id) => {
    const target = id ? '/' + id : '/'
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target)
    }
    setSessionId(id)
    setIsProfile(false)
    setIsPublic(false)
  }, [])

  const navigateToProfile = useCallback(() => {
    if (window.location.pathname !== '/profile') {
      window.history.pushState({}, '', '/profile')
    }
    setIsProfile(true)
    setSessionId(null)
    setIsPublic(false)
  }, [])

  const navigateToPublic = useCallback(() => {
    if (window.location.pathname !== '/public') {
      window.history.pushState({}, '', '/public')
    }
    setIsPublic(true)
    setSessionId(null)
    setIsProfile(false)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const onPop = () => {
      const id = getSessionIdFromUrl()
      const profile = isProfileRoute()
      const publicRoute = isPublicRoute()
      setSessionId(id)
      setIsProfile(profile)
      setIsPublic(publicRoute)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const clearStaleSession = useCallback(() => {
    const hadUrlSession = Boolean(getSessionIdFromUrl())
    window.history.replaceState({}, '', '/')
    setSessionId(null)
    setIsProfile(false)
    setIsPublic(false)
    return hadUrlSession
  }, [])

  return {
    sessionId,
    isProfile,
    isPublic,
    navigateTo,
    navigateToProfile,
    navigateToPublic,
    clearStaleSession,
  }
}
