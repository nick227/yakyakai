import { memo, useEffect, useMemo, useRef } from 'react'
import { Bot, ListChecks } from 'lucide-react'
import DOMPurify from 'dompurify'
import { STATUS_LABELS, RUN_STATUS } from '../lib/uiConstants.js'
import { hydrateChatContent } from '../lib/chatHydrator.js'
import { HYDRATOR_SMOKE_MESSAGE } from '../lib/hydratorSmokeMessage.js'

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

const ChatStream = memo(function ChatStream({ outputs, chatMessages, plan, status, riverRef, onScroll, isLoadingMessages, sessionNotFound, onNewChat, showHydratorSmoke = false, accessLevel = null }) {
  const internalRef = useRef(null)
  const ref = riverRef || internalRef

  const isLoading = chatMessages.length === 0 && LOADING_STATUSES.has(status)
  const isStreaming = LOADING_STATUSES.has(status)
  const isReadOnly = accessLevel === 'read-only'

  const sortedMessages = useMemo(() => {
    if (chatMessages.length <= 1) return chatMessages
    const sorted = chatMessages.slice()
    sorted.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'USER' ? -1 : 1
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
          {showHydratorSmoke && (
            <ChatMessage key={HYDRATOR_SMOKE_MESSAGE.id} msg={HYDRATOR_SMOKE_MESSAGE} index={0} />
          )}
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
  const emptyStateMessages = [
    'What should YakyakAI keep working on?',
    'Give it a goal. Watch it work.',
    'Well hello, how are you doing today?',
    "What should YakyakAI build next?",
    "Let's keep the momentum going.",
    "Start a thread, YakyakAI will discuss.",
    "What should we explore and evolve?",
    "Drop a direction, let's groove on it.",
    "Give it something to iterate on.",
    "What are you developing today?",
    "The chat is ready—drop in a direction.",
    "What idea should we keep working on?",
    "Feed it a goal, watch the cycles unfold.",
    "What should it plan and expand?",
    "Give it a starting point—it won’t stop there.",
    "AI is just a fancy database, let's go.",
    "Start it up big dog.",
    "What should we break down and build out?",
    "Give me a new problem to work on.",
    "What should we work on next?",
    "Welcome to the new Internet.",
    "Hi, what are we generating about today?",
    "Send a prompt and let's get started."
  ];
  const emptyStateCopy = [
    "Give it a goal and it will plan focused prompts, stream useful output, and keep expanding into adjacent ideas as it goes.",
    "Start with a simple direction and it will build, refine, and continue generating useful work until you stop it.",
    "Drop in a goal and it will break it down, explore angles, and keep producing structured output over time.",
    "Give it something to work on and it will continuously plan, generate, and evolve the results step by step.",
    "Start a thread and it will expand it into deeper ideas, structured outputs, and ongoing iterations.",
    "Provide a goal and it will move through cycles of planning, generating, and refining without losing momentum.",
    "Kick it off with an idea and it will explore, connect, and keep producing useful outputs in a steady flow.",
    "Give it a direction and it will generate structured work, then shift into related ideas and continue building.",
    "Start anywhere and it will create a chain of useful outputs, each one building on the last.",
    "Drop a prompt and it will plan, execute, and continue expanding the work into adjacent directions.",
    "Give it a goal and it will keep producing, refining, and extending the output as it cycles forward.",
    "Start a concept and it will break it down, expand it, and keep generating new layers of insight.",
    "Provide a starting point and it will continuously evolve the work through structured cycles.",
    "Give it something interesting and it will explore it deeply while branching into connected ideas.",
    "Start the stream and it will keep generating structured, useful outputs without stopping.",
    "Feed it a goal and it will plan, build, and keep pushing the work forward across multiple angles.",
    "Give it a prompt and it will expand it into a full stream of ideas, outputs, and refinements.",
    "Start with a direction and it will continuously generate and evolve useful content from it.",
    "Drop an idea and it will explore it, refine it, and extend it into new directions over time.",
    "Give it something to solve and it will iterate through approaches while building structured outputs.",
    "Start a thread and it will grow it into multiple layers of ideas and actionable outputs.",
    "Provide a goal and it will keep cycling through planning, generating, and improving the work.",
    "Give it a concept and it will expand it into detailed outputs and connected ideas.",
    "Start with a prompt and it will turn it into an evolving stream of useful results.",
    "Feed it direction and it will keep building, refining, and branching into new areas.",
    "Give it something to develop and it will keep producing structured, meaningful outputs.",
    "Start a flow and it will continue generating work across multiple connected angles.",
    "Drop a goal and it will keep expanding the work into deeper and broader directions.",
    "Give it a starting point and it will keep evolving the output without losing momentum.",
    "Start with anything and it will turn it into a continuous stream of useful, structured work."
  ];
  const randomMessage = emptyStateMessages[Math.floor(Math.random() * emptyStateMessages.length)];
  const randomCopy = emptyStateCopy[Math.floor(Math.random() * emptyStateCopy.length)];
  return (
    <div className="empty-state chat-empty">
      <div className="hero-eyebrow">Streaming GPT interface</div>
      <h1 className="hero-title">{randomMessage}</h1>
      <p className="hero-copy">
        {randomCopy}
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
  const messageBodyRef = useRef(null)

  useEffect(() => {
    if (messageBodyRef.current && !isUser && !isNotice) {
      hydrateChatContent(messageBodyRef.current)
    }
  }, [msg.content, isUser, isNotice])
  
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
      ADD_ATTR: ['target', 'rel', 'class', 'loading', 'referrerpolicy', 'src', 'allowfullscreen', 'frameborder', 'allow'],
      ADD_TAGS: ['img', 'iframe'],
    })
    return (
      <article className='chat-message media-message'>
        <div className="msg-avatar" aria-hidden="true"><Bot size={13} /></div>
        <div className="msg-content">
          <div className="chat-message-body" ref={messageBodyRef} dangerouslySetInnerHTML={{ __html: safe }} />
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
        <div className="chat-message-body" ref={messageBodyRef} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content || '') }} />
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
