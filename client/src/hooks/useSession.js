import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { EventTypes } from '../lib/eventTypes.js'
import { TERMINAL_STATUSES, RUN_STATUS } from '../lib/uiConstants.js'

const BEACON_VISIBLE = new Blob(['{"visible":true}'], { type: 'application/json' })
const BEACON_HIDDEN = new Blob(['{"visible":false}'], { type: 'application/json' })
const HEARTBEAT_INTERVAL_MS = 5_000

function parseEventMessage(message) {
  try {
    return JSON.parse(message.data)
  } catch {
    return null
  }
}

function isSessionAccessDenied(err) {
  return err?.code === 'SESSION_ACCESS_DENIED' || err?.status === 401
}

function shouldClearSessionRoute(err) {
  return Boolean(
    isSessionAccessDenied(err) ||
    err?.status === 403 ||
    err?.status === 404 ||
    err?.code === 'VALIDATION_ERROR'
  )
}

function normalizeSessionStatus(status) {
  return status === RUN_STATUS.CANCELLED ? RUN_STATUS.STOPPED : status
}

function isViewingScreen() {
  if (typeof document === 'undefined') return true
  return document.visibilityState === 'visible'
}

export function useSession(sessionId, onLoadSession, onEvent, onSessionAccessDenied) {
  const [status, setStatus] = useState(RUN_STATUS.IDLE)
  const [cycleCount, setCycleCount] = useState(0)
  const [nextDelay, setNextDelay] = useState(null)
  const [runError, setRunError] = useState(null)
  const [accessLevel, setAccessLevel] = useState(null)
  const heartbeatRef = useRef(null)
  const onLoadSessionRef = useRef(onLoadSession)
  const onEventRef = useRef(onEvent)
  const onSessionAccessDeniedRef = useRef(onSessionAccessDenied)
  const lastEventIdRef = useRef(null)
  const [eventsVersion, setEventsVersion] = useState(0)
  const [isViewing, setIsViewing] = useState(isViewingScreen)
  const isViewingRef = useRef(isViewing)
  const pauseTimerRef = useRef(null)
  const lastResumeAtRef = useRef(0)

  useEffect(() => {
    onLoadSessionRef.current = onLoadSession
  }, [onLoadSession])

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    onSessionAccessDeniedRef.current = onSessionAccessDenied
  }, [onSessionAccessDenied])

  useEffect(() => {
    isViewingRef.current = isViewing
  }, [isViewing])

  useEffect(() => {
    if (!sessionId || !isViewing) return

    api.getSession(sessionId)
      .then((res) => {
        if (res.session) {
          setStatus(normalizeSessionStatus(res.session.status))
          setCycleCount(res.session.cycleCount)
          setAccessLevel(res.accessLevel || null)
          onLoadSessionRef.current?.(res.session)
        }
      })
      .catch((err) => {
        console.error('[loadSession] Failed to load session:', err.message)
        if (shouldClearSessionRoute(err)) onSessionAccessDeniedRef.current?.()
      })

    let sse = null
    let stopped = false
    let reconnectAttempts = 0
    let isConnecting = false
    const MAX_RECONNECT_ATTEMPTS = 5
    const BASE_RETRY_DELAY_MS = 500
    const HEALTH_CHECK_INTERVAL_MS = 30_000
    let lastEventTime = Date.now()
    let healthCheckTimer = null

    const closeSse = () => {
      if (!sse) return
      sse.close()
      sse = null
      isConnecting = false
      if (healthCheckTimer) {
        clearTimeout(healthCheckTimer)
        healthCheckTimer = null
      }
    }

    const startHealthCheck = () => {
      if (healthCheckTimer) clearTimeout(healthCheckTimer)
      healthCheckTimer = setTimeout(() => {
        if (stopped) return
        const timeSinceLastEvent = Date.now() - lastEventTime
        if (timeSinceLastEvent > HEALTH_CHECK_INTERVAL_MS) {
          console.warn(`[sse] Health check failed: no events for ${timeSinceLastEvent}ms, forcing reconnect`)
          closeSse()
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts += 1
            const delay = BASE_RETRY_DELAY_MS * Math.pow(2, reconnectAttempts - 1)
            setRunError(`Connection stale. Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
            setTimeout(() => {
              if (!stopped && isViewingRef.current) connectSse()
            }, delay)
          } else {
            setRunError('Connection lost. Please refresh.')
          }
        } else {
          startHealthCheck()
        }
      }, HEALTH_CHECK_INTERVAL_MS)
    }

    const openSse = () => {
      sse = new EventSource(api.eventsUrl(sessionId, lastEventIdRef.current))
      lastEventTime = Date.now()

      sse.onopen = () => {
        isConnecting = false
      }

      sse.onmessage = (msg) => {
        lastEventTime = Date.now()
        const ev = parseEventMessage(msg)
        if (!ev) {
          console.log('[sse] Failed to parse message:', msg.data)
          return
        }
        if (ev.type !== EventTypes.HEARTBEAT) {
          setRunError(null)
          reconnectAttempts = 0
        }
        if (ev.eventId && ev.eventId === lastEventIdRef.current) return
        if (ev.eventId) lastEventIdRef.current = ev.eventId

        console.log('[sse] Event received:', ev.type, 'payload:', ev.payload, 'ts:', ev.ts)

        // Forward all events to parent handler
        onEventRef.current?.(ev)

        switch (ev.type) {
          case EventTypes.CONNECTED: {
            const { status: connStatus } = ev.payload || {}
            console.log('[sse] Connected, server status:', connStatus)
            startHealthCheck()
            if (connStatus) {
              const norm = normalizeSessionStatus(connStatus)
              setStatus(norm)
              if (TERMINAL_STATUSES.has(norm)) {
                stopped = true
                closeSse()
              }
            }
            break
          }
          case EventTypes.STATUS: {
            const { status: nextStatus, cycle, nextIn, code } = ev.payload || {}
            if (!nextStatus) break
            console.log('[sse] Status →', nextStatus, cycle != null ? `cycle ${cycle}` : '')
            const normalizedStatus = normalizeSessionStatus(nextStatus)
            setStatus(normalizedStatus)
            if (TERMINAL_STATUSES.has(normalizedStatus)) {
              stopped = true
              closeSse()
            }
            if (cycle != null) setCycleCount(cycle)
            if (nextIn != null) {
              setNextDelay(nextIn)
            } else if (nextStatus !== RUN_STATUS.CYCLING) {
              setNextDelay(null)
            }
            if (normalizedStatus === RUN_STATUS.FAILED) {
              if (code === 'PROMPT_LIMIT_REACHED' || code === 'TOKEN_LIMIT_REACHED' || code === 'CREDIT_LIMIT_REACHED') {
                setRunError('CREDITS_EXHAUSTED')
              } else {
                setRunError('This run was interrupted. Resume or start again.')
              }
            }
            break
          }
          default:
            break
        }
      }

      sse.onerror = (e) => {
        if (stopped) return
        closeSse()
        isConnecting = false
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          setRunError('Connection lost. Please refresh.')
          return
        }
        reconnectAttempts += 1
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, reconnectAttempts - 1)
        console.warn(`[sse] Connection error, reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`, e)
        setRunError(`Connection interrupted. Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
        setTimeout(() => {
          if (!stopped && isViewingRef.current) connectSse()
        }, delay)
      }
    }

    const connectSse = () => {
      if (isConnecting || sse || stopped || !isViewingRef.current) return
      isConnecting = true
      openSse()
    }

    connectSse()

    return () => {
      stopped = true
      console.log('[sse] Closing event stream for session', sessionId)
      closeSse()
    }
  }, [sessionId, eventsVersion, isViewing])

  useEffect(() => {
    if (!sessionId) return

    const beat = (visible = isViewingScreen()) =>
      api.heartbeat(sessionId, visible).catch(() => {})

    const beaconBeat = (visible) => {
      navigator.sendBeacon?.(`/api/sessions/${sessionId}/heartbeat`, visible ? BEACON_VISIBLE : BEACON_HIDDEN)
    }

    const onVisibilityChange = () => {
      const visible = isViewingScreen()
      if (visible) {
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current)
          pauseTimerRef.current = null
        }
        setIsViewing(true)
        const now = Date.now()
        if (now - lastResumeAtRef.current < 300) {
          beaconBeat(true)
          return
        }
        lastResumeAtRef.current = now
        beaconBeat(true)
        return
      }

      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = setTimeout(() => {
        setIsViewing(false)
        beaconBeat(false)
        pauseTimerRef.current = null
      }, 50)
    }

    const onPageHide = () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current)
        pauseTimerRef.current = null
      }
      setIsViewing(false)
      beaconBeat(false)
    }

    beat(isViewingScreen())
    heartbeatRef.current = setInterval(beat, HEARTBEAT_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      clearInterval(heartbeatRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current)
        pauseTimerRef.current = null
      }
    }
  }, [sessionId])

  const reconnectEvents = () => {
    if (!sessionId) return
    setEventsVersion((v) => v + 1)
  }

  return { status, cycleCount, nextDelay, runError, accessLevel, setStatus, setRunError, reconnectEvents }
}
