import { memo } from 'react'
import { Bot, ShieldCheck, History } from 'lucide-react'
import { STATUS_LABELS, TERMINAL_STATUSES, RUN_STATUS } from '../lib/uiConstants.js'

const AppFrame = memo(function AppFrame({
  children,
  user,
  status = RUN_STATUS.IDLE,
  showAdmin = false,
  onAdmin,
  onLogout,
  onSidebar,
  onProfile,
}) {
  const live = !TERMINAL_STATUSES.has(status) && status !== RUN_STATUS.PAUSED

  return (
    <div className="app-shell page-yakyakai">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            {onSidebar && (
              <button
                className="icon-button"
                type="button"
                onClick={onSidebar}
                title="Chat history"
                aria-label="Open chat history"
              >
                <History size={15} />
              </button>
            )}
            <div className="brand-mark" aria-hidden="true"><Bot size={16} /></div>
            <div className="brand-copy">
              <div className="brand-title"><a href="/">YakyakAI</a></div>
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
                onClick={onProfile || onLogout}
                type="button"
                title={`${user.name || user.email} — view profile`}
                aria-label="View profile"
              >
                {user.avatarUrl
                  ? <img src={user.avatarUrl} alt={user.name || user.email} referrerPolicy="no-referrer" />
                  : (user.name?.[0] || user.email?.[0])?.toUpperCase() ?? '?'
                }
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
