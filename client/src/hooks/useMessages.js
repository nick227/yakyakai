import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'

const INITIAL_MESSAGES_LIMIT = 1
const HISTORY_PAGE_SIZE = 49
const HISTORY_LOAD_PAUSE_MS = 300
const LOAD_MORE_TOP_PX = 100

function isSessionAccessDenied(err) {
  return err?.code === 'SESSION_ACCESS_DENIED' || err?.status === 401
}

export function useMessages(sessionId, riverRef, onSessionAccessDenied) {
  const [chatMessages, setChatMessages] = useState([])
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const isLoadingMessagesRef = useRef(false)
  const pendingScrollRef = useRef(null)
  const hydratedSessionRef = useRef(null)

  const loadMessages = useCallback(async (targetSessionId, before = null, mode = 'initial', limit = HISTORY_PAGE_SIZE) => {
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
      const newMessages = res.messages || []
      setChatMessages((prev) => {
        if (before) {
          return [...newMessages, ...prev]
        }
        return newMessages
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
  }, [riverRef])

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
    const river = riverRef.current
    if (!river || !sessionId || isLoadingMessages || !hasMoreMessages || chatMessages.length === 0) return

    const shouldHydrateAfterInitialMessage =
      hydratedSessionRef.current !== sessionId && chatMessages.length === INITIAL_MESSAGES_LIMIT
    const shouldBackfillUntilScrollable =
      hydratedSessionRef.current === sessionId && river.scrollHeight <= river.clientHeight + 1

    if (!shouldHydrateAfterInitialMessage && !shouldBackfillUntilScrollable) return

    const oldestMessage = chatMessages[0]
    if (!oldestMessage?.createdAt) return

    if (shouldHydrateAfterInitialMessage) hydratedSessionRef.current = sessionId
    const timer = window.setTimeout(() => {
      loadMessages(sessionId, oldestMessage.createdAt, 'prepend', HISTORY_PAGE_SIZE)
    }, HISTORY_LOAD_PAUSE_MS)

    return () => window.clearTimeout(timer)
  }, [sessionId, chatMessages, hasMoreMessages, isLoadingMessages, loadMessages, riverRef])

  useEffect(() => {
    if (!sessionId) return
    hydratedSessionRef.current = null
    loadMessages(sessionId, null, 'initial', INITIAL_MESSAGES_LIMIT)
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
