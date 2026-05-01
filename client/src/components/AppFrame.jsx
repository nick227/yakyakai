import { memo } from 'react'
import { Bot, ShieldCheck, History, Link, Home } from 'lucide-react'
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
  onCopyLink,
}) {
  const live = !TERMINAL_STATUSES.has(status) && status !== RUN_STATUS.PAUSED

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.pathname)
    if (onCopyLink) onCopyLink()
  }

  return (
    <div className="app-shell page-yakyakai">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <div className="brand-copy">
              <div className="brand-title"><a href="/">YakyakAI</a></div>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => window.location.href = '/' }
              title="Yakyakai.com"
              aria-label="Open home page"
            >
              <Bot size={15} />
            </button>
              <button
                className="icon-button"
                type="button"
                onClick={() => window.location.href = '/public' }
                title="Public Sessions"
                aria-label="Open session gallery"
              >
                <Home size={15} />
              </button>
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
          </div>

          <div className="flex items-center gap-2 topbar-actions">
            {onCopyLink && (
              <button
                className="icon-button"
                type="button"
                onClick={handleCopyLink}
                title="Copy link"
                aria-label="Copy link to this session"
              >
                <Link size={15} />
              </button>
            )}

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
