import { useCallback, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { RUN_STATUS, TERMINAL_STATUSES, PACE } from '../lib/uiConstants.js'
import { useSessionRouter } from './useSessionRouter.js'
import { useSession } from './useSession.js'
import { useMessages } from './useMessages.js'
import { useOutputs } from './useOutputs.js'

export function useAppController() {
  const { sessionId, isProfile, navigateTo, navigateToProfile, clearStaleSession } = useSessionRouter()
  
  // Grouped UI state
  const [uiState, setUiState] = useState({
    showAdmin: false,
    showSidebar: false,
    sessionNotFound: false,
  })
  
  const [prompt, setPrompt] = useState('')
  const [pace, setPace] = useState(PACE.STEADY)
  const riverRef = useRef(null)
  const pendingScrollRef = useRef(null)

  const updateUiState = useCallback((updates) => {
    setUiState((prev) => ({ ...prev, ...updates }))
  }, [])

  const { chatMessages, hasMoreMessages, isLoadingMessages, handleScroll, setChatMessages } = useMessages(
    sessionId,
    riverRef,
    clearStaleSession
  )

  const { outputs, plan, handleSSEEvent, reset: resetOutputs } = useOutputs(
    riverRef,
    (shouldStick) => {
      pendingScrollRef.current = { type: 'live', shouldStick }
    }
  )

  const { status, cycleCount, nextDelay, runError, setStatus, setRunError } = useSession(
    sessionId,
    (session) => {
      setPace(session.pace)
      if (session.title) document.title = `YakyakAI - ${session.title}`
    },
    (ev) => handleSSEEvent(ev, setChatMessages),
    clearStaleSession
  )

  // Consolidated reset logic
  const clearSessionState = useCallback(() => {
    resetOutputs()
    setChatMessages([])
    setStatus(RUN_STATUS.IDLE)
    setRunError(null)
    updateUiState({ sessionNotFound: false })
  }, [resetOutputs, setChatMessages, setStatus, setRunError, updateUiState])

  const toRunErrorCode = useCallback((err) => {
    if (err?.code === 'PROMPT_LIMIT_REACHED' || err?.code === 'TOKEN_LIMIT_REACHED') return 'CREDITS_EXHAUSTED'
    return err?.message || 'Unable to start run'
  }, [])

  const start = useCallback(async () => {
    if (!prompt.trim()) return
    console.log('[start] Submitting prompt, pace:', pace, 'length:', prompt.length)
    setRunError(null)
    updateUiState({ sessionNotFound: false })
    navigateTo(null)
    clearSessionState()
    
    const optimisticClientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setChatMessages([{
      id: `optimistic-${Date.now()}`,
      clientId: optimisticClientId,
      role: 'USER',
      content: prompt,
      createdAt: new Date().toISOString(),
      metadata: JSON.stringify({ clientId: optimisticClientId }),
    }])

    try {
      setStatus(RUN_STATUS.QUEUED)
      const res = await api.start(prompt, pace, optimisticClientId)
      console.log('[start] Session created:', res.sessionId, 'status:', res.status)
      navigateTo(res.sessionId)
    } catch (err) {
      console.error('[start] Failed to create session:', err.message)
      setStatus(RUN_STATUS.IDLE)
      setRunError(toRunErrorCode(err))
    }
  }, [prompt, pace, setRunError, updateUiState, navigateTo, clearSessionState, setChatMessages, setStatus, toRunErrorCode])

  const pauseRun = useCallback(async () => {
    if (!sessionId) return
    setRunError(null)
    setStatus(RUN_STATUS.PAUSED)
    try {
      await api.pause(sessionId)
    } catch (err) {
      setStatus(RUN_STATUS.RUNNING)
      setRunError(err.message || 'Unable to pause run')
    }
  }, [sessionId, setStatus, setRunError])

  const resumeRun = useCallback(async () => {
    if (!sessionId) return
    setRunError(null)
    setStatus(RUN_STATUS.RUNNING)
    try {
      await api.resume(sessionId)
    } catch (err) {
      setStatus(RUN_STATUS.PAUSED)
      setRunError(err.message || 'Unable to resume run')
    }
  }, [sessionId, setStatus, setRunError])

  const stopRun = useCallback(async () => {
    if (!sessionId) return
    const previousStatus = status
    setRunError(null)
    try {
      await api.stop(sessionId)
      setStatus(RUN_STATUS.STOPPED)
    } catch (err) {
      setStatus(previousStatus)
      setRunError(err.message || 'Unable to stop run')
    }
  }, [sessionId, status, setStatus, setRunError])

  const navigateToSession = useCallback((id) => {
    clearSessionState()
    navigateTo(id)
  }, [clearSessionState, navigateTo])

  const startNewChat = useCallback(() => {
    clearSessionState()
    setPrompt('')
    navigateTo(null)
  }, [clearSessionState, navigateTo])

  const toggleAdmin = useCallback(() => {
    updateUiState({ showAdmin: !uiState.showAdmin })
  }, [uiState.showAdmin, updateUiState])

  const openSidebar = useCallback(() => {
    updateUiState({ showSidebar: true })
  }, [updateUiState])

  const closeSidebar = useCallback(() => {
    updateUiState({ showSidebar: false })
  }, [updateUiState])

  // Derived values
  const isActive = Boolean(sessionId) && !TERMINAL_STATUSES.has(status)
  const canStart = Boolean(prompt.trim()) && !isActive
  const canPause = isActive && status !== RUN_STATUS.PAUSED
  const canResume = Boolean(sessionId) && status === RUN_STATUS.PAUSED
  const canStop = isActive || status === RUN_STATUS.PAUSED
  const promptCount = prompt.length
  const approxTokens = Math.ceil(promptCount / 4)

  return {
    state: {
      uiState,
      prompt,
      pace,
      sessionId,
      isProfile,
      chatMessages,
      outputs,
      plan,
      status,
      cycleCount,
      nextDelay,
      runError,
      hasMoreMessages,
      isLoadingMessages,
      riverRef,
    },
    actions: {
      setPrompt,
      setPace,
      start,
      pauseRun,
      resumeRun,
      stopRun,
      navigateToSession,
      startNewChat,
      toggleAdmin,
      openSidebar,
      closeSidebar,
      handleScroll,
      navigateToProfile,
    },
    derived: {
      isActive,
      canStart,
      canPause,
      canResume,
      canStop,
      promptCount,
      approxTokens,
    },
  }
}
