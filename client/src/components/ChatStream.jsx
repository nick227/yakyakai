import { memo, useMemo, useRef } from 'react'
import { Bot, ListChecks } from 'lucide-react'
import DOMPurify from 'dompurify'
import { STATUS_LABELS, RUN_STATUS } from '../lib/uiConstants.js'

const LOADING_STATUSES = new Set([
  RUN_STATUS.QUEUED,
  RUN_STATUS.PLANNING,
  RUN_STATUS.RUNNING,
  RUN_STATUS.EXPANDING,
  RUN_STATUS.CYCLING,
])

const metadataCache = new Map()

function parseMetadataSafe(raw) {
  if (!raw) return {}
  if (metadataCache.has(raw)) return metadataCache.get(raw)
  try {
    const parsed = JSON.parse(raw)
    metadataCache.set(raw, parsed)
    return parsed
  } catch {
    return {}
  }
}

const ChatStream = memo(function ChatStream({ outputs, chatMessages, plan, status, riverRef, onScroll, isLoadingMessages, sessionNotFound, onNewChat }) {
  const internalRef = useRef(null)
  const ref = riverRef || internalRef

  const isLoading = chatMessages.length === 0 && LOADING_STATUSES.has(status)
  const isStreaming = LOADING_STATUSES.has(status)

  const sortedMessages = useMemo(() => {
    if (chatMessages.length <= 1) return chatMessages
    const sorted = chatMessages.slice()
    sorted.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : Infinity
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : Infinity
      if (ta !== tb) return ta - tb
      if (a.id && b.id) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      return 0
    })
    return sorted
  }, [chatMessages])

  return (
    <section className="stream-column" ref={ref} onScroll={onScroll}>
      {isLoadingMessages && (
        <div className="loading-more" role="status" aria-live="polite">
          <span className="loading-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="loading-label">Loading more messages</span>
        </div>
      )}
      {sessionNotFound ? (
        <SessionNotFoundState onNewChat={onNewChat} />
      ) : isLoading ? (
        <LoadingState status={status} />
      ) : sortedMessages.length === 0 ? (
        <EmptyChatState />
      ) : (
        <div className="chat-stream">
          {plan && <PlanCard plan={plan} />}
          {sortedMessages.map((msg, i) => (
            <ChatMessage key={msg.id || msg.clientId || `${msg.role}-${msg.createdAt || i}`} msg={msg} index={i} />
          ))}
          {isStreaming && <SkeletonLoader />}
        </div>
      )}
    </section>
  )
})

function LoadingState({ status }) {
  const label = STATUS_LABELS[status] || status
  return (
    <div className="empty-state chat-loading">
      <div className="loading-indicator" role="status" aria-live="polite">
        <span className="pill-dot is-live" />
        <span className="loading-label">{label}</span>
      </div>
    </div>
  )
}

function EmptyChatState() {
  return (
    <div className="empty-state chat-empty">
      <div className="hero-eyebrow">Streaming GPT interface</div>
      <h1 className="hero-title">What should YakyakAI keep working on?</h1>
      <p className="hero-copy">
        Give it a goal. It will plan focused prompts, stream useful output, then keep shifting into adjacent work until you stop it.
      </p>
    </div>
  )
}

function SessionNotFoundState({ onNewChat }) {
  return (
    <div className="empty-state chat-empty">
      <div className="hero-eyebrow">Session not found</div>
      <h1 className="hero-title">This chat doesn't exist.</h1>
      <p className="hero-copy">
        It may have been deleted, or the link is incorrect.
      </p>
      {onNewChat && (
        <button type="button" className="button button-primary" onClick={onNewChat}>
          Start new chat
        </button>
      )}
    </div>
  )
}

const ChatMessage = memo(function ChatMessage({ msg, index }) {
  const isUser = msg.role === 'USER'
  const metadata = parseMetadataSafe(msg.metadata)
  const isNotice = metadata.isNotice
  const isMedia = metadata.isMedia
  
  if (isUser) {
    return (
      <article className="chat-message user-message">
        <div className="msg-avatar user-avatar" aria-hidden="true">U</div>
        <div className="msg-content">
          <div className="chat-message-body user-content">{msg.content}</div>
        </div>
      </article>
    )
  }
  
  if (isNotice) {
    return (
      <article className='chat-message notice-message'>
        <div className="msg-avatar" aria-hidden="true"><Bot size={13} /></div>
        <div className="msg-content">
          <div className="chat-message-body notice-body">{msg.content}</div>
        </div>
      </article>
    )
  }
  
  if (isMedia) {
    const safe = DOMPurify.sanitize(msg.content || '', {
      ADD_ATTR: ['target', 'rel', 'class', 'loading', 'referrerpolicy'],
      ADD_TAGS: ['img'],
    })
    return (
      <article className='chat-message media-message'>
        <div className="msg-avatar" aria-hidden="true"><Bot size={13} /></div>
        <div className="msg-content">
          <div className="chat-message-body" dangerouslySetInnerHTML={{ __html: safe }} />
        </div>
      </article>
    )
  }

  return (
    <article className='chat-message'>
      <div className="msg-avatar" aria-hidden="true"><Bot size={13} /></div>
      <div className="msg-content">
        <div className="chat-message-header">
          <span className="pill small-pill">#{(metadata.index ?? index) + 1}</span>
          {metadata.cycle > 1 && <span className="pill small-pill">C{metadata.cycle}</span>}
        </div>
        <div className="chat-message-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content || '') }} />
      </div>
    </article>
  )
})

const PlanCard = memo(function PlanCard({ plan }) {
  const labels = plan.steps ?? plan.prompts
  const visible = labels?.length > 7 ? labels.slice(0, 7) : labels

  return (
    <article className="plan-card">
      <div className="msg-avatar" aria-hidden="true"><ListChecks size={13} /></div>
      <div className="msg-content">
        <div className="chat-message-header">
          <span className="pill small-pill">Plan</span>
        </div>
        <ol>
          {visible?.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      </div>
    </article>
  )
})

function SkeletonLoader() {
  return (
    <article className="chat-message skeleton-message">
      <div className="msg-avatar" aria-hidden="true"><Bot size={13} /></div>
      <div className="msg-content">
        <div className="skeleton-header">
          <div className="skeleton-pill" />
        </div>
        <div className="skeleton-body">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line-short" />
        </div>
      </div>
    </article>
  )
}

export default ChatStream
