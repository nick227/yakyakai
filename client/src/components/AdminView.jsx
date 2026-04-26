import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { post } from '../api/client.js'
import { fmtTokens, timeAgo } from '../lib/format.js'

const ADMIN_STATUS = {
  queued: 'Starting',
  planning: 'Planning',
  running: 'Exploring',
  expanding: 'Expanding',
  cycling: 'Between cycles',
  paused: 'Paused',
}

export default function AdminView({ onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    const load = () =>
      fetch('/api/admin/online', { credentials: 'include' })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(body.message || body.error || 'Unable to load admin activity')
          return body
        })
        .then((d) => {
          if (mounted) {
            setData(d)
            setError(null)
          }
        })
        .catch((e) => { if (mounted) setError(e.message) })

    load()
    const interval = setInterval(load, 5000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  async function forceStop(sessionId) {
    await post(`/api/admin/sessions/${sessionId}/stop`).catch(() => {})
    setData((value) => {
      if (!value?.sessions?.length) return value
      const sessions = value.sessions.filter((s) => s.sessionId !== sessionId)
      return sessions.length === value.sessions.length ? value : { ...value, sessions }
    })
  }

  return (
    <section className="admin-panel panel">
      <div className="panel-inner stack">
        <div className="row-between">
          <div>
            <h2 className="run-title">Live activity</h2>
            <p className="run-note">Active sessions, token movement, and force-stop controls.</p>
          </div>
          <button className="button button-ghost icon-text" onClick={onClose} type="button">
            <X size={16} />
            Close
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}

        {data && (
          <>
            <div className="admin-stats">
              <AdminStat value={data.stats?.activeSessions ?? 0} label="Active now" />
              <AdminStat value={fmtTokens(data.stats?.tokensLastHour)} label="Tokens / hr" />
              <AdminStat value={fmtTokens(data.stats?.tokensToday)} label="Tokens today" />
              <AdminStat value={data.stats?.callsToday ?? 0} label="AI calls today" />
            </div>

            {!data.sessions?.length ? (
              <p className="stream-empty">No active sessions right now.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Status</th>
                      <th>Cycle</th>
                      <th>Pace</th>
                      <th>Session tokens</th>
                      <th>Monthly tokens</th>
                      <th>Monthly calls</th>
                      <th>Last seen</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map((session) => (
                      <tr key={session.sessionId}>
                        <td>
                          <span className="admin-email">{session.email}</span>
                          {session.name && <span className="admin-name">{session.name}</span>}
                        </td>
                        <td><span className="pill small-pill">{ADMIN_STATUS[session.status] || session.status}</span></td>
                        <td>{session.cycleCount}</td>
                        <td>{session.pace}</td>
                        <td>{fmtTokens(session.sessionTokens)}</td>
                        <td>{fmtTokens(session.monthlyTokens)}</td>
                        <td>{session.monthlyPrompts}</td>
                        <td>{timeAgo(session.lastHeartbeatAt)}</td>
                        <td>
                          <button className="button button-danger" onClick={() => forceStop(session.sessionId)} type="button">
                            Stop
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="run-note">Auto-refreshes every 5s. Last updated {new Date(data.ts).toLocaleTimeString()}</p>
          </>
        )}

        {!data && !error && <p className="stream-empty">Loading...</p>}
      </div>
    </section>
  )
}

function AdminStat({ value, label }) {
  return (
    <div className="admin-stat">
      <span className="admin-stat-value">{value}</span>
      <span className="admin-stat-label">{label}</span>
    </div>
  )
}
