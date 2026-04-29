import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { EventTypes } from '../lib/eventTypes.js'
import { TERMINAL_STATUSES, RUN_STATUS } from '../lib/uiConstants.js'

const BEACON_VISIBLE = new Blob(['{"visible":true}'], { type: 'application/json' })
const BEACON_HIDDEN = new Blob(['{"visible":false}'], { type: 'application/json' })

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
    if (!sessionId) return

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

    const closeSse = () => {
      if (!sse) return
      sse.close()
      sse = null
    }

    const openSse = () => {
      sse = new EventSource(api.eventsUrl(sessionId, lastEventIdRef.current))

      sse.onmessage = (msg) => {
        const ev = parseEventMessage(msg)
        if (!ev) {
          console.log('[sse] Failed to parse message:', msg.data)
          return
        }
        if (ev.type !== EventTypes.HEARTBEAT) setRunError(null)
        if (ev.eventId && ev.eventId === lastEventIdRef.current) return
        if (ev.eventId) lastEventIdRef.current = ev.eventId

        console.log('[sse] Event received:', ev.type, 'payload:', ev.payload, 'ts:', ev.ts)

        // Forward all events to parent handler
        onEventRef.current?.(ev)

        switch (ev.type) {
          case EventTypes.CONNECTED: {
            const { status: connStatus } = ev.payload || {}
            console.log('[sse] Connected, server status:', connStatus)
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
              if (code === 'PROMPT_LIMIT_REACHED' || code === 'TOKEN_LIMIT_REACHED') {
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
        if (reconnectAttempts >= 1) {
          setRunError('Connection lost. Please refresh.')
          return
        }
        reconnectAttempts += 1
        console.warn('[sse] Connection error, attempting one reconnect', e)
        setRunError('Connection interrupted. Reconnecting...')
        setTimeout(() => {
          if (!stopped) openSse()
        }, 350)
      }
    }

    openSse()

    return () => {
      stopped = true
      console.log('[sse] Closing event stream for session', sessionId)
      closeSse()
    }
  }, [sessionId, eventsVersion])

  useEffect(() => {
    if (!sessionId) return

    const beat = (visible = document.visibilityState !== 'hidden') =>
      api.heartbeat(sessionId, visible).catch(() => {})

    const beaconBeat = (visible) => {
      navigator.sendBeacon?.(`/api/sessions/${sessionId}/heartbeat`, visible ? BEACON_VISIBLE : BEACON_HIDDEN)
    }

    const onVisibilityChange = () => beaconBeat(document.visibilityState !== 'hidden')
    const onPageHide = () => beaconBeat(false)

    beat(true)
    heartbeatRef.current = setInterval(beat, 15_000)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      clearInterval(heartbeatRef.current)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [sessionId])

  const reconnectEvents = () => {
    if (!sessionId) return
    setEventsVersion((v) => v + 1)
  }

  return { status, cycleCount, nextDelay, runError, accessLevel, setStatus, setRunError, reconnectEvents }
}
