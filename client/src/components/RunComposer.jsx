import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Gauge, LoaderCircle, Pause, Play, Send, Sparkles, Square } from 'lucide-react'
import { PACE_KEYS, PACE_LABELS } from '../lib/uiConstants.js'
import ExportActions from './ExportActions.jsx'
import CreditsModal from './CreditsModal.jsx'

function useCountdown(ms) {
  const [secs, setSecs] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    clearInterval(intervalRef.current)
    if (ms == null) {
      setSecs(null)
      return
    }
    let s = Math.ceil(ms / 1000)
    setSecs(s)
    intervalRef.current = setInterval(() => {
      s -= 1
      if (s <= 0) {
        clearInterval(intervalRef.current)
        setSecs(null)
      } else {
        setSecs(s)
      }
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [ms])

  return secs
}

const RunComposer = memo(function RunComposer({
  prompt,
  pace,
  isActive,
  canStart,
  canPause,
  canResume,
  canStop,
  runError,
  promptCount,
  approxTokens,
  cycleCount = 0,
  nextDelay = null,
  sessionId = null,
  messages = [],
  onPromptChange,
  onPaceChange,
  onStart,
  onPause,
  onResume,
  onStop,
}) {
  const nextIn = useCountdown(nextDelay)
  const isStreaming = isActive && !canResume
  const [showCredits, setShowCredits] = useState(false)
  const openCredits = useCallback(() => setShowCredits(true), [])
  const closeCredits = useCallback(() => setShowCredits(false), [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && canStart) {
      e.preventDefault()
      onStart()
    }
  }

  return (
    <section className="composer-dock" aria-label="Run composer">
      <div className="composer-shell">
        <textarea
          className="chat-input"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? 'Run in progress…' : 'Ask YakyakAI to explore, build, compare, draft, or plan…'}
          disabled={isStreaming}
        />

        <div className="composer-footer">
          <div className="cluster pace-cluster" aria-label={isActive ? 'Run status' : 'Pace'}>
            {isActive ? (
              <div className="run-status">
                <span className={`pill-dot ${isActive ? 'is-live' : ''}`} />
                <span>{isActive ? 'Running' : 'Idle'}</span>
                {cycleCount > 0 && (
                  <>
                    <span className="pill-sep" />
                    <span>Cycle {cycleCount}</span>
                  </>
                )}
                {nextIn != null && (
                  <>
                    <span className="pill-sep" />
                    <span>Next {nextIn}s</span>
                  </>
                )}
                {isStreaming && (
                  <span className="streaming-indicator" aria-label="Streaming in progress">
                    <LoaderCircle size={16} className="streaming-spinner" aria-hidden="true" />
                  </span>
                )}
              </div>
            ) : (
              <>
                <Gauge size={13} className="text-muted" />
                {PACE_KEYS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`pace-chip ${pace === value ? 'is-active' : ''}`}
                    onClick={() => onPaceChange(value)}
                  >
                    {PACE_LABELS[value]}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="cluster run-actions" aria-label="Run controls">
            {sessionId && <ExportActions title="YakyakAI Export" sessionId={sessionId} messages={messages} />}
            {canPause && (
              <button className="icon-button" type="button" onClick={onPause} title="Pause" aria-label="Pause run">
                <Pause size={15} />
              </button>
            )}
            {canResume && (
              <button className="icon-button button-primary" type="button" onClick={onResume} title="Resume" aria-label="Resume run">
                <Play size={15} />
              </button>
            )}
            {canStop && (
              <button className="icon-button button-danger" type="button" onClick={onStop} title="Stop" aria-label="Stop run">
                <Square size={15} />
              </button>
            )}
            <button
              className="send-button"
              disabled={!canStart}
              onClick={onStart}
              type="button"
              title={isActive ? 'Running' : 'Start run'}
              aria-label={isActive ? 'Running' : 'Start run'}
            >
              {isActive ? <Sparkles size={16} /> : <Send size={16} />}
              <span>{isActive ? 'Running' : 'Start'}</span>
            </button>
          </div>
        </div>

        {runError && (
          runError === 'CREDITS_EXHAUSTED' ? (
            <div className="credits-alert">
              <span className="credits-alert-text">You've used all your credits for this month.</span>
              <button type="button" className="button button-primary credits-alert-cta" onClick={openCredits}>Add credits</button>
            </div>
          ) : (
            <p className="composer-error form-error">{runError}</p>
          )
        )}
        {showCredits && <CreditsModal onClose={closeCredits} />}
      </div>
    </section>
  )
})

export default RunComposer
