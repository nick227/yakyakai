import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'
import { EventTypes } from '../lib/eventTypes.js'
import { TERMINAL_STATUSES } from '../lib/uiConstants.js'

const BEACON_VISIBLE = new Blob(['{"visible":true}'], { type: 'application/json' })
const BEACON_HIDDEN = new Blob(['{"visible":false}'], { type: 'application/json' })

function parseEventMessage(message) {
  try {
    return JSON.parse(message.data)
  } catch {
    return null
  }
}

export function useSession(sessionId, onLoadSession, onEvent) {
  const [status, setStatus] = useState('idle')
  const [cycleCount, setCycleCount] = useState(0)
  const [nextDelay, setNextDelay] = useState(null)
  const [runError, setRunError] = useState(null)
  const heartbeatRef = useRef(null)

  useEffect(() => {
    if (!sessionId) return

    api.getSession(sessionId)
      .then((res) => {
        if (res.session) {
          setStatus(res.session.status)
          setCycleCount(res.session.cycleCount)
          onLoadSession?.(res.session)
        }
      })
      .catch((err) => {
        console.error('[loadSession] Failed to load session:', err.message)
      })

    const sse = new EventSource(api.eventsUrl(sessionId))

    sse.onmessage = (msg) => {
      const ev = parseEventMessage(msg)
      if (!ev) {
        console.log('[sse] Failed to parse message:', msg.data)
        return
      }
      setRunError(null)

      console.log('[sse] Event received:', ev.type, 'payload:', ev.payload, 'ts:', ev.ts)

      // Forward all events to parent handler
      onEvent?.(ev)

      switch (ev.type) {
        case EventTypes.CONNECTED: {
          const { status: connStatus } = ev.payload || {}
          console.log('[sse] Connected, server status:', connStatus)
          if (connStatus) setStatus(connStatus)
          break
        }
        case EventTypes.STATUS: {
          const { status: nextStatus, cycle, nextIn } = ev.payload || {}
          if (!nextStatus) break
          console.log('[sse] Status →', nextStatus, cycle != null ? `cycle ${cycle}` : '')
          setStatus(nextStatus)
          if (TERMINAL_STATUSES.has(nextStatus)) sse.close()
          if (cycle != null) setCycleCount(cycle)
          if (nextIn != null) {
            setNextDelay(nextIn)
          } else if (nextStatus !== 'cycling') {
            setNextDelay(null)
          }
          break
        }
        default:
          break
      }
    }

    sse.onerror = (e) => {
      console.warn('[sse] Connection error / reconnecting', e)
      setRunError('Connection interrupted. Reconnecting...')
    }

    return () => {
      console.log('[sse] Closing event stream for session', sessionId)
      sse.close()
    }
  }, [sessionId, onLoadSession, onEvent])

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

  return { status, cycleCount, nextDelay, runError, setStatus, setRunError }
}
