import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'

const PAGE_SIZE = 50
const LOAD_MORE_TOP_PX = 100

function isSessionAccessDenied(err) {
  return err?.code === 'SESSION_ACCESS_DENIED' || err?.status === 401
}

function parseClientId(metadata) {
  if (!metadata) return null
  try {
    const parsed = JSON.parse(metadata)
    return parsed?.clientId || null
  } catch {
    return null
  }
}

export function useMessages(sessionId, riverRef, onSessionAccessDenied) {
  const [chatMessages, setChatMessages] = useState([])
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const isLoadingMessagesRef = useRef(false)
  const pendingScrollRef = useRef(null)
  const hydratedSessionRef = useRef(null)

  const loadMessages = useCallback(async (targetSessionId, before = null, mode = 'initial', limit = PAGE_SIZE) => {
    if (isLoadingMessagesRef.current) return false
    isLoadingMessagesRef.current = true
    setIsLoadingMessages(true)

    const river = riverRef.current
    if (before && river) {
      pendingScrollRef.current = {
        type: mode === 'backfill' ? 'bottom' : 'prepend',
        previousHeight: river.scrollHeight,
        previousTop: river.scrollTop,
      }
    } else {
      pendingScrollRef.current = { type: 'bottom' }
    }

    try {
      const res = await api.messages(targetSessionId, before, limit)
      const newMessages = (res.messages || []).map((message) => ({
        ...message,
        serverId: message.id,
        clientId: parseClientId(message.metadata),
      }))
      setChatMessages((prev) => {
        if (before) {
          // Load-more: strip any DB messages already in state to avoid duplicates
          const existingIds = new Set()
          for (let i = 0; i < prev.length; i++) {
            if (prev[i].id) existingIds.add(prev[i].id)
          }
          const deduped = []
          for (let i = 0; i < newMessages.length; i++) {
            const m = newMessages[i]
            if (!m.id || !existingIds.has(m.id)) deduped.push(m)
          }
          return [...deduped, ...prev]
        }
        // Initial load: preserve live SSE messages not yet in DB, drop optimistic placeholders
        const dbIds = new Set()
        const dbClientIds = new Set()
        for (let i = 0; i < newMessages.length; i++) {
          if (newMessages[i].id) dbIds.add(newMessages[i].id)
          if (newMessages[i].clientId) dbClientIds.add(newMessages[i].clientId)
        }
        const liveOnly = []
        for (let i = 0; i < prev.length; i++) {
          const m = prev[i]
          if (m.id &&
              !String(m.id).startsWith('optimistic-') &&
              !dbIds.has(m.id) &&
              !(m.clientId && dbClientIds.has(m.clientId))) {
            liveOnly.push(m)
          }
        }
        return [...newMessages, ...liveOnly]
      })
      setHasMoreMessages(newMessages.length >= limit)
      return newMessages.length > 0
    } catch (err) {
      pendingScrollRef.current = null
      console.error('[loadMessages] Failed to load messages:', err.message)
      if (isSessionAccessDenied(err)) onSessionAccessDenied?.()
      return false
    } finally {
      isLoadingMessagesRef.current = false
      setIsLoadingMessages(false)
    }
  }, [onSessionAccessDenied, riverRef])

  useLayoutEffect(() => {
    const river = riverRef.current
    const action = pendingScrollRef.current
    if (!river || !action) return

    if (action.type === 'prepend') {
      river.scrollTop = river.scrollHeight - action.previousHeight + action.previousTop
    } else if (action.type === 'bottom') {
      river.scrollTop = river.scrollHeight
    } else if (action.type === 'live' && action.shouldStick) {
      river.scrollTop = river.scrollHeight
    }

    pendingScrollRef.current = null
  }, [chatMessages, riverRef])

  useEffect(() => {
    if (!sessionId) return
    hydratedSessionRef.current = null
    queueMicrotask(() => {
      loadMessages(sessionId, null, 'initial', PAGE_SIZE)
    })
  }, [sessionId, loadMessages])

  const handleScroll = useCallback(() => {
    const river = riverRef.current
    if (!river || !sessionId || isLoadingMessages || !hasMoreMessages) return

    if (river.scrollTop < LOAD_MORE_TOP_PX) {
      const oldestMessage = chatMessages[0]
      if (oldestMessage?.createdAt) {
        loadMessages(sessionId, oldestMessage.createdAt)
      }
    }
  }, [sessionId, chatMessages, isLoadingMessages, hasMoreMessages, loadMessages, riverRef])

  return { chatMessages, hasMoreMessages, isLoadingMessages, handleScroll, setChatMessages }
}
