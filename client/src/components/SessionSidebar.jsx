import { useEffect, useState, useCallback, useRef } from 'react'
import { X, PenSquare, Pencil, Trash2, Check } from 'lucide-react'
import { api } from '../api/client.js'
import { RUN_STATUS } from '../lib/uiConstants.js'

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
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

export default function SessionSidebar({ isOpen, currentSessionId, onClose, onNavigate, onNewChat, onSessionDeleted }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const editInputRef = useRef(null)
  const listRef = useRef(null)

  const load = useCallback(async ({ reset = false } = {}) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await api.listSessions(20, reset ? null : nextCursor)
      const items = res.sessions || []
      setSessions((prev) => (reset ? items : [...prev, ...items]))
      setNextCursor(res.nextCursor || null)
    } catch (err) {
      console.error('[SessionSidebar] Failed to load sessions:', err)
    } finally {
      if (reset) setLoading(false)
      else setLoadingMore(false)
    }
  }, [nextCursor])

  useEffect(() => {
    if (!isOpen) return
    setNextCursor(null)
    load({ reset: true })
  }, [isOpen, load])

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  const startEdit = useCallback((e, session) => {
    e.stopPropagation()
    setConfirmDeleteId(null)
    setEditingId(session.id)
    setEditValue(session.title || '')
  }, [])

  const saveEdit = useCallback(async (id) => {
    const value = editValue.trim()
    if (!value) { setEditingId(null); return }
    try {
      await api.renameSession(id, value)
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: value } : s))
    } catch {}
    setEditingId(null)
  }, [editValue])

  const cancelEdit = useCallback(() => setEditingId(null), [])

  const requestDelete = useCallback((e, id) => {
    e.stopPropagation()
    setEditingId(null)
    setConfirmDeleteId(id)
  }, [])

  const confirmDelete = useCallback(async (id) => {
    try {
      await api.deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (id === currentSessionId) onSessionDeleted?.()
    } catch {}
    setConfirmDeleteId(null)
  }, [currentSessionId, onSessionDeleted])

  const handleListScroll = useCallback(() => {
    if (!listRef.current || loading || loadingMore || !nextCursor) return
    const el = listRef.current
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceToBottom < 100) {
      load({ reset: false })
    }
  }, [loading, loadingMore, nextCursor, load])

  if (!isOpen) return null

  return (
    <>
      <div className="session-drawer-backdrop" onClick={onClose} />
      <aside className="session-drawer">
        <div className="session-drawer-header">
          <span className="session-drawer-title">Chats</span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close sidebar">
            <X size={15} />
          </button>
        </div>

        <div className="session-drawer-body" ref={listRef} onScroll={handleListScroll}>
          {loading && <div className="session-drawer-empty">Loading…</div>}
          {!loading && sessions.length === 0 && (
            <div className="session-drawer-empty">No previous chats.</div>
          )}
          {sessions.map(s => {
            const isEditing = editingId === s.id
            const isConfirming = confirmDeleteId === s.id
            const isActive = s.id === currentSessionId

            if (isEditing) {
              return (
                <div key={s.id} className="session-item is-editing">
                  <StatusDot status={s.status} />
                  <span className="session-item-body">
                    <input
                      ref={editInputRef}
                      className="session-item-edit"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(s.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={() => saveEdit(s.id)}
                    />
                  </span>
                  <span className="session-item-actions" style={{ opacity: 1 }}>
                    <button className="session-item-action-btn" type="button" onMouseDown={() => saveEdit(s.id)} title="Save">
                      <Check size={13} />
                    </button>
                  </span>
                </div>
              )
            }

            if (isConfirming) {
              return (
                <div key={s.id} className={`session-item is-confirming${isActive ? ' is-active' : ''}`}>
                  <StatusDot status={s.status} />
                  <span className="session-item-body">
                    <span className="session-item-title">Delete this chat?</span>
                  </span>
                  <span className="session-item-actions" style={{ opacity: 1 }}>
                    <button
                      className="session-item-action-btn is-danger"
                      type="button"
                      onClick={() => confirmDelete(s.id)}
                      title="Confirm delete"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      className="session-item-action-btn"
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </span>
                </div>
              )
            }

            return (
              <button
                key={s.id}
                type="button"
                className={`session-item${isActive ? ' is-active' : ''}`}
                onClick={() => { onNavigate(s.id); onClose() }}
              >
                <StatusDot status={s.status} />
                <span className="session-item-body">
                  <span className="session-item-title">{s.title || 'Untitled session'}</span>
                  <span className="session-item-meta">{relativeTime(s.createdAt)}</span>
                </span>
                <span className="session-item-actions">
                  <span
                    className="session-item-action-btn"
                    role="button"
                    tabIndex={0}
                    onClick={e => startEdit(e, s)}
                    onKeyDown={e => e.key === 'Enter' && startEdit(e, s)}
                    title="Rename"
                  >
                    <Pencil size={13} />
                  </span>
                  <span
                    className="session-item-action-btn is-danger"
                    role="button"
                    tabIndex={0}
                    onClick={e => requestDelete(e, s.id)}
                    onKeyDown={e => e.key === 'Enter' && requestDelete(e, s.id)}
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </span>
                </span>
              </button>
            )
          })}
          {loadingMore && <div className="session-drawer-empty">Loading more…</div>}
        </div>

        <div className="session-drawer-footer">
          <button
            type="button"
            className="button button-ghost full-width"
            onClick={() => { onNewChat(); onClose() }}
          >
            <PenSquare size={14} />
            New chat
          </button>
        </div>
      </aside>
    </>
  )
}
