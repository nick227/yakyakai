import { useCallback, useState } from 'react'
import DOMPurify from 'dompurify'
import { EventTypes } from '../lib/eventTypes.js'

const MAX_VISIBLE_OUTPUTS = 80

function appendVisibleOutput(outputs, output) {
  const next = output?.html
    ? { ...output, html: DOMPurify.sanitize(output.html) }
    : output
  if (outputs.length < MAX_VISIBLE_OUTPUTS) return [...outputs, next]
  const arr = outputs.slice(1)
  arr.push(next)
  return arr
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
        console.log('[sse] Plan received:', ev.payload?.prompts?.length, 'prompts')
        setPlan(ev.payload)
        break
      case EventTypes.OUTPUT:
        console.log('[sse] Output received for index:', ev.payload?.index)
        setOutputs((prev) => appendVisibleOutput(prev, ev.payload))
        onScrollToBottom?.(isNearBottom(riverRef.current))
        setChatMessages((prev) => {
          const metadata = { cycle: ev.payload?.cycle, index: ev.payload?.index }
          return [...prev, {
            clientId: `live-${ev.ts || Date.now()}-${ev.payload?.index ?? prev.length}`,
            role: 'ASSISTANT',
            content: ev.payload?.html || '',
            metadata: JSON.stringify(metadata),
          }]
        })
        break
      case EventTypes.NOTICE:
        console.log('[sse] Notice received:', ev.payload?.message)
        setChatMessages((prev) => {
          const newMessage = {
            clientId: `notice-${ev.ts || Date.now()}`,
            role: 'ASSISTANT',
            content: ev.payload?.message || '',
            metadata: JSON.stringify({ isNotice: true }),
          }
          console.log('[sse] Adding notice message to chat:', newMessage)
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
