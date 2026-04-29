import { useEffect, useState, useCallback, useRef } from 'react'
import { Globe, ChevronRight } from 'lucide-react'
import { api } from '../api/client.js'
import { RUN_STATUS } from '../lib/uiConstants.js'

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const LIVE_STATUSES = new Set([
  RUN_STATUS.QUEUED,
  RUN_STATUS.RUNNING,
  RUN_STATUS.PLANNING,
  RUN_STATUS.CYCLING,
])

function StatusDot({ status }) {
  if (LIVE_STATUSES.has(status)) return <span className="session-item-dot is-live" />
  if (status === RUN_STATUS.FAILED) return <span className="session-item-dot is-failed" />
  return <span className="session-item-dot" />
}

export default function PublicGallery({ onNavigate }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const listRef = useRef(null)

  const load = useCallback(async ({ reset = false } = {}) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await api.listPublicSessions(20, reset ? null : nextCursor)
      const items = res.sessions || []
      setSessions((prev) => (reset ? items : [...prev, ...items]))
      setNextCursor(res.nextCursor || null)
    } catch {
      // silent — gallery is non-critical
    } finally {
      if (reset) setLoading(false)
      else setLoadingMore(false)
    }
  }, [nextCursor])

  useEffect(() => {
    load({ reset: true })
  }, [load])

  const handleListScroll = useCallback(() => {
    if (!listRef.current || loading || loadingMore || !nextCursor) return
    const el = listRef.current
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceToBottom < 100) {
      load({ reset: false })
    }
  }, [loading, loadingMore, nextCursor, load])

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header-card">
          <div className="profile-avatar-large">
            <Globe size={32} />
          </div>
          <div className="profile-name">Public Sessions</div>
          <div className="profile-email">Explore what others are building</div>
        </div>

        <div className="profile-sessions">
          <div className="profile-section-header">
            <Globe size={18} />
            <span>Session Gallery</span>
          </div>

          {loading ? (
            <div className="profile-loading">Loading adventures...</div>
          ) : sessions.length === 0 ? (
            <div className="profile-empty">No public sessions yet. Be the first to share!</div>
          ) : (
            <div className="profile-session-list" ref={listRef} onScroll={handleListScroll}>
              {sessions.map((session) => (
                <div key={session.id} className="profile-session-item" onClick={() => onNavigate(session.id)}>
                  <StatusDot status={session.status} />
                  <div className="profile-session-info">
                    <div className="profile-session-title">{session.title || 'Untitled session'}</div>
                    <div className="profile-session-time">
                      @{session.user?.name || 'anonymous'} • {relativeTime(session.updatedAt)} • {session.cycleCount} steps
                    </div>
                  </div>
                  <ChevronRight size={14} className="profile-session-arrow" />
                </div>
              ))}
              {loadingMore && <div className="profile-loading">Loading more...</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
