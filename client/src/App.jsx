import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot } from 'lucide-react'
import { api } from './api/client.js'
import { getMe, logout } from './api/authApi.js'
import { EventTypes } from './lib/eventTypes.js'
import { TERMINAL_STATUSES } from './lib/uiConstants.js'
import AppFrame from './components/AppFrame.jsx'
import AuthGate from './components/AuthGate.jsx'
import ChatStream from './components/ChatStream.jsx'
import RunComposer from './components/RunComposer.jsx'
import AdminView from './components/AdminView.jsx'
import { useSession } from './hooks/useSession.js'
import { useMessages } from './hooks/useMessages.js'
import { useOutputs } from './hooks/useOutputs.js'

function App({ user, onLogout }) {
  const [prompt, setPrompt] = useState('')
  const [pace, setPace] = useState('steady')
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('yakyakai_sessionId') || null
  })
  const [showAdmin, setShowAdmin] = useState(false)
  const riverRef = useRef(null)
  const pendingScrollRef = useRef(null)

  const clearStaleSession = useCallback(() => {
    setSessionId(null)
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
    (session) => setPace(session.pace),
    (ev) => handleSSEEvent(ev, setChatMessages),
    clearStaleSession
  )

  useEffect(() => {
    localStorage.setItem('yakyakai_sessionId', sessionId || '')
  }, [sessionId])

  async function start() {
    if (!prompt.trim()) return
    console.log('[start] Submitting prompt, pace:', pace, 'length:', prompt.length)
    setRunError(null)
    setSessionId(null)
    resetOutputs()
    setChatMessages([])
    setStatus('idle')

    try {
      setStatus('queued')
      const res = await api.start(prompt, pace)
      console.log('[start] Session created:', res.sessionId, 'status:', res.status)
      setSessionId(res.sessionId)
    } catch (err) {
      console.error('[start] Failed to create session:', err.message)
      setStatus('idle')
      setRunError(err.message || 'Unable to start run')
    }
  }

  const pauseRun = useCallback(async () => {
    if (!sessionId) return
    setRunError(null)
    setStatus('paused')
    try {
      await api.pause(sessionId)
    } catch (err) {
      setStatus('running')
      setRunError(err.message || 'Unable to pause run')
    }
  }, [sessionId, setStatus])

  const resumeRun = useCallback(async () => {
    if (!sessionId) return
    setRunError(null)
    setStatus('running')
    try {
      await api.resume(sessionId)
    } catch (err) {
      setStatus('paused')
      setRunError(err.message || 'Unable to resume run')
    }
  }, [sessionId, setStatus])

  const stopRun = useCallback(async () => {
    if (!sessionId) return
    const previousStatus = status
    setRunError(null)
    try {
      await api.stop(sessionId)
      setStatus('stopped')
    } catch (err) {
      setStatus(previousStatus)
      setRunError(err.message || 'Unable to stop run')
    }
  }, [sessionId, status, setStatus])

  const handleLogout = useCallback(async () => {
    try { await logout() } catch {}
    onLogout()
  }, [onLogout])

  const toggleAdmin = useCallback(() => setShowAdmin((v) => !v), [])

  const isActive = Boolean(sessionId) && !TERMINAL_STATUSES.has(status)
  const canStart = Boolean(prompt.trim()) && !isActive
  const canPause = isActive && status !== 'paused'
  const canResume = Boolean(sessionId) && status === 'paused'
  const canStop = isActive || status === 'paused'
  const promptCount = prompt.length
  const approxTokens = Math.ceil(promptCount / 4)

  return (
    <AppFrame
      user={user}
      status={status}
      showAdmin={showAdmin}
      onAdmin={toggleAdmin}
      onLogout={handleLogout}
    >
      {showAdmin ? (
        <main className="center-page">
          <AdminView onClose={toggleAdmin} />
        </main>
      ) : (
        <main className="chat-shell">
          <ChatStream 
            outputs={outputs} 
            chatMessages={chatMessages} 
            plan={plan} 
            status={status} 
            riverRef={riverRef} 
            onScroll={handleScroll}
            isLoadingMessages={isLoadingMessages}
          />
          <RunComposer
            prompt={prompt}
            pace={pace}
            isActive={isActive}
            canStart={canStart}
            canPause={canPause}
            canResume={canResume}
            canStop={canStop}
            runError={runError}
            promptCount={promptCount}
            approxTokens={approxTokens}
            cycleCount={cycleCount}
            nextDelay={nextDelay}
            sessionId={sessionId}
            messages={chatMessages}
            onPromptChange={setPrompt}
            onPaceChange={setPace}
            onStart={start}
            onPause={pauseRun}
            onResume={resumeRun}
            onStop={stopRun}
          />
        </main>
      )}
    </AppFrame>
  )
}

export default function Root() {
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    getMe()
      .then((data) => setUser(data.user || null))
      .catch(() => setUser(null))
  }, [])

  if (user === undefined) {
    return (
      <AppFrame status="idle">
        <main className="center-page splash-page">
          <div className="brand-mark splash-mark"><Bot size={28} /></div>
        </main>
      </AppFrame>
    )
  }

  if (!user) return <AuthGate onAuth={setUser} />
  return <App user={user} onLogout={() => setUser(null)} />
}
