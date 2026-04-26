import { memo } from 'react'
import { Bot, ShieldCheck } from 'lucide-react'
import { STATUS_LABELS, TERMINAL_STATUSES } from '../lib/uiConstants.js'

const AppFrame = memo(function AppFrame({
  children,
  user,
  status = 'idle',
  showAdmin = false,
  onAdmin,
  onLogout,
}) {
  const live = !TERMINAL_STATUSES.has(status) && status !== 'paused'

  return (
    <div className="app-shell page-yakyakai">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true"><Bot size={16} /></div>
            <div className="brand-copy">
              <div className="brand-title">YakyakAI</div>
            </div>
          </div>

          <div className="flex items-center gap-2 topbar-actions">
            <span className="pill status-pill">
              <span className={live ? 'pill-dot is-live' : 'pill-dot'} />
              {STATUS_LABELS[status] || status}
            </span>

            {user?.role === 'ADMIN' && (
              <button
                className={`icon-button ${showAdmin ? 'is-active' : ''}`}
                onClick={onAdmin}
                type="button"
                title="Admin panel"
                aria-label="Toggle admin panel"
              >
                <ShieldCheck size={15} />
              </button>
            )}

            {user && (
              <button
                className="avatar-button"
                onClick={onLogout}
                type="button"
                title={`${user.email} — click to sign out`}
                aria-label="Sign out"
              >
                {user.email?.[0]?.toUpperCase() ?? '?'}
              </button>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  )
})

export default AppFrame
