import { useCallback, useState } from 'react'
import DOMPurify from 'dompurify'
import { EventTypes } from '../lib/eventTypes.js'

const MAX_VISIBLE_OUTPUTS = 80

function appendVisibleOutput(outputs, output) {
  const next = output?.html
    ? { ...output, html: DOMPurify.sanitize(output.html) }
    : output
  if (outputs.length < MAX_VISIBLE_OUTPUTS) {
    const result = new Array(outputs.length + 1)
    for (let i = 0; i < outputs.length; i++) {
      result[i] = outputs[i]
    }
    result[outputs.length] = next
    return result
  }
  const result = new Array(MAX_VISIBLE_OUTPUTS)
  for (let i = 0; i < MAX_VISIBLE_OUTPUTS - 1; i++) {
    result[i] = outputs[i + 1]
  }
  result[MAX_VISIBLE_OUTPUTS - 1] = next
  return result
}

function isNearBottom(el) {
  if (!el) return true
  const NEAR_BOTTOM_PX = 120
  return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
}

export function useOutputs(riverRef, onScrollToBottom) {
  const [outputs, setOutputs] = useState([])
  const [plan, setPlan] = useState(null)

  const handleSSEEvent = useCallback((ev, setChatMessages) => {
    switch (ev.type) {
      case EventTypes.PLAN:
        console.log('[sse] Plan received:', (ev.payload?.steps ?? ev.payload?.prompts)?.length, 'steps')
        setPlan(ev.payload)
        break
      case EventTypes.OUTPUT:
        console.log('[sse] Output received for index:', ev.payload?.index)
        setOutputs((prev) => appendVisibleOutput(prev, ev.payload))
        onScrollToBottom?.(isNearBottom(riverRef.current))
        setChatMessages((prev) => {
          const messageId = ev.payload?.messageId
          if (messageId && prev.some(m => m.id === messageId)) return prev
          const metadata = {
            cycle: ev.payload?.cycle,
            index: ev.payload?.index,
            ...(ev.payload?.isMedia ? { isMedia: true, kind: ev.payload?.kind, provider: ev.payload?.provider } : {}),
          }
          return [...prev, {
            id: messageId,
            clientId: messageId || `live-${ev.ts || Date.now()}-${ev.payload?.index ?? prev.length}`,
            role: 'ASSISTANT',
            content: ev.payload?.html || '',
            createdAt: ev.payload?.createdAt,
            metadata: JSON.stringify(metadata),
          }]
        })
        break
      case EventTypes.NOTICE:
        console.log('[sse] Notice received:', ev.payload?.message)
        setChatMessages((prev) => {
          const messageId = ev.payload?.messageId
          if (messageId && prev.some(m => m.id === messageId)) return prev
          const newMessage = {
            id: messageId,
            clientId: messageId || `notice-${ev.ts || Date.now()}`,
            role: 'ASSISTANT',
            content: ev.payload?.message || '',
            createdAt: ev.payload?.createdAt,
            metadata: JSON.stringify({ isNotice: true }),
          }
          console.log('[sse] Adding notice message to chat:', newMessage)
          return [...prev, newMessage]
        })
        break
      case EventTypes.FAST_INTRO:
        console.log('[sse] Fast intro received:', ev.payload?.intro)
        setChatMessages((prev) => {
          const newMessage = {
            id: `fast-intro-${ev.ts || Date.now()}`,
            clientId: `fast-intro-${ev.ts || Date.now()}`,
            role: 'ASSISTANT',
            content: ev.payload?.intro || '',
            createdAt: new Date().toISOString(),
            metadata: JSON.stringify({ isFastIntro: true }),
          }
          console.log('[sse] Adding fast intro message to chat:', newMessage)
          return [...prev, newMessage]
        })
        break
      default:
        break
    }
  }, [riverRef, onScrollToBottom])

  const reset = useCallback(() => {
    setOutputs([])
    setPlan(null)
  }, [])

  return { outputs, plan, handleSSEEvent, reset }
}
