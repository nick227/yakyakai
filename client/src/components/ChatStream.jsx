import { memo, useRef } from 'react'
import { Bot, ListChecks } from 'lucide-react'
import DOMPurify from 'dompurify'
import { STATUS_LABELS } from '../lib/uiConstants.js'

const LOADING_STATUSES = new Set(['queued', 'planning', 'running', 'expanding', 'cycling'])

const ChatStream = memo(function ChatStream({ outputs, chatMessages, plan, status, riverRef, onScroll, isLoadingMessages }) {
  const internalRef = useRef(null)
  const ref = riverRef || internalRef

  const isLoading = chatMessages.length === 0 && LOADING_STATUSES.has(status)

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
      {isLoading ? (
        <LoadingState status={status} />
      ) : chatMessages.length === 0 ? (
        <EmptyChatState />
      ) : (
        <div className="chat-stream">
          {plan && <PlanCard plan={plan} />}
          {chatMessages.map((msg, i) => (
            <ChatMessage key={msg.id || msg.clientId || `${msg.role}-${msg.createdAt || i}`} msg={msg} index={i} />
          ))}
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

const ChatMessage = memo(function ChatMessage({ msg, index }) {
  const isUser = msg.role === 'USER'
  const metadata = msg.metadata ? JSON.parse(msg.metadata) : {}
  const isNotice = metadata.isNotice
  
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
  const prompts = plan.prompts?.length > 7 ? plan.prompts.slice(0, 7) : plan.prompts

  return (
    <article className="plan-card">
      <div className="msg-avatar" aria-hidden="true"><ListChecks size={13} /></div>
      <div className="msg-content">
        <div className="chat-message-header">
          <span className="pill small-pill">Plan</span>
        </div>
        <ol>
          {prompts?.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      </div>
    </article>
  )
})

export default ChatStream
