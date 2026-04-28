import { useState, useEffect, useCallback } from 'react'
import { LogOut, Key, Clock, Trophy, Zap, Gamepad2, Star, ChevronRight, Plus } from 'lucide-react'
import { api } from '../api/client.js'
import { logout, forgotPassword } from '../api/authApi.js'
import CreditsModal from './CreditsModal.jsx'

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

export default function Profile({ user, onLogout }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalSessions: 0, remainingCredits: 0, creditsUsed: 0 })
  const [showPasswordReset, setShowPasswordReset] = useState(false)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetMessage, setResetMessage] = useState('')

  useEffect(() => {
    loadSessions()
    loadCredits()
  }, [])

  const loadSessions = async () => {
    try {
      const res = await api.listSessions(50)
      const items = res.sessions || []
      setSessions(items)
      
      const totalSessions = items.length
      
      setStats(prev => ({ ...prev, totalSessions }))
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadCredits = async () => {
    try {
      const creditsData = await api.getCredits()
      const remainingCredits = creditsData.creditBalance || 0
      const creditsUsed = creditsData.promptsUsed || 0
      setStats(prev => ({ ...prev, remainingCredits, creditsUsed }))
    } catch (err) {
      console.error('Failed to load credits:', err)
    }
  }

  const handleLogout = async () => {
    await onLogout()
  }

  const handlePasswordReset = async (e) => {
    e.preventDefault()
    try {
      await forgotPassword(resetEmail || user.email)
      setResetMessage('Check your email for reset instructions!')
      setShowPasswordReset(false)
      setResetEmail('')
    } catch (err) {
      setResetMessage(err.message || 'Failed to send reset email')
    }
    setTimeout(() => setResetMessage(''), 5000)
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Retro header card */}
        <div className="profile-header-card">
          <div className="profile-avatar-large">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name || user.email} referrerPolicy="no-referrer" />
            ) : (
              <span className="profile-avatar-initial">{(user.name?.[0] || user.email?.[0])?.toUpperCase() ?? '?'}</span>
            )}
          </div>
          
          <div className="profile-name">{user.name || 'Player'}</div>
          <div className="profile-email">{user.email}</div>
          
          <div className="profile-role-badge">
            <Star size={12} />
            <span>{user.role === 'ADMIN' ? 'Admin Wizard' : 'Adventurer'}</span>
          </div>
        </div>

        {/* Stats grid - game style */}
        <div className="profile-stats-grid">
          <div className="stat-card pixel-border">
            <div className="stat-icon">
              <Gamepad2 size={20} />
            </div>
            <div className="stat-value">{stats.totalSessions}</div>
            <div className="stat-label">Sessions</div>
          </div>
          
          <div className="stat-card pixel-border">
            <div className="stat-icon">
              <Zap size={20} />
            </div>
            <div className="stat-value">{stats.remainingCredits}</div>
            <div className="stat-label">Credits</div>
          </div>
          
          <div className="stat-card pixel-border">
            <div className="stat-icon">
              <Trophy size={20} />
            </div>
            <div className="stat-value">{stats.creditsUsed}</div>
            <div className="stat-label">Used This Month</div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="profile-actions">
          <button 
            className="retro-button retro-button-primary"
            onClick={() => setShowCreditsModal(true)}
          >
            <Plus size={16} />
            <span>Add Credits</span>
          </button>
          
          <button 
            className="retro-button retro-button-secondary"
            onClick={() => setShowPasswordReset(true)}
          >
            <Key size={16} />
            <span>Reset Password</span>
          </button>
          
          <button 
            className="retro-button retro-button-danger"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>

        {/* Session history */}
        <div className="profile-sessions">
          <div className="profile-section-header">
            <Clock size={18} />
            <span>Session History</span>
          </div>
          
          {loading ? (
            <div className="profile-loading">Loading adventures...</div>
          ) : sessions.length === 0 ? (
            <div className="profile-empty">No adventures yet. Start a new quest!</div>
          ) : (
            <div className="profile-session-list">
              {sessions.slice(0, 10).map((session) => (
                <div key={session.id} className="profile-session-item">
                  <div className="session-item-dot" />
                  <div className="profile-session-info">
                    <div className="profile-session-title">{session.title || 'Untitled session'}</div>
                    <div className="profile-session-time">{relativeTime(session.createdAt)}</div>
                  </div>
                  <ChevronRight size={14} className="profile-session-arrow" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Password reset modal */}
        {showPasswordReset && (
          <div className="profile-modal-overlay" onClick={() => setShowPasswordReset(false)}>
            <div className="profile-modal pixel-border" onClick={(e) => e.stopPropagation()}>
              <div className="profile-modal-header">
                <Key size={20} />
                <span>Reset Password</span>
              </div>
              <form onSubmit={handlePasswordReset} className="profile-modal-form">
                <div className="form-group">
                  <label>Email address</label>
                  <input
                    type="email"
                    value={resetEmail || user.email}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="retro-input"
                  />
                </div>
                <div className="profile-modal-actions">
                  <button 
                    type="button" 
                    className="retro-button retro-button-secondary"
                    onClick={() => setShowPasswordReset(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="retro-button retro-button-primary">
                    Send Reset Link
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Credits modal */}
        {showCreditsModal && (
          <CreditsModal onClose={() => setShowCreditsModal(false)} />
        )}

        {/* Toast message */}
        {resetMessage && (
          <div className="profile-toast pixel-border">
            {resetMessage}
          </div>
        )}
      </div>
    </div>
  )
}
