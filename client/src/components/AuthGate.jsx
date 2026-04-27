import { useState, useEffect, useRef } from 'react'
import { LogIn, UserPlus, Mail, KeyRound } from 'lucide-react'
import { login, register, forgotPassword, resetPassword, googleAuth } from '../api/authApi.js'
import AppFrame from './AppFrame.jsx'

export default function AuthGate({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', token: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const googleBtnRef = useRef(null)
  // Always-current callback ref so the Google SDK never holds a stale closure
  const googleCallbackRef = useRef(null)
  googleCallbackRef.current = async ({ credential }) => {
    setBusy(true)
    setError(null)
    try {
      const data = await googleAuth(credential)
      onAuth(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (key) => (e) => setForm((value) => ({ ...value, [key]: e.target.value }))

  // Detect reset token in URL on mount
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (token) {
      setForm(f => ({ ...f, token }))
      setMode('reset')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Load Google Identity Services and render button + One Tap
  useEffect(() => {
    function initGoogle() {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response) => googleCallbackRef.current(response),
      })
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: googleBtnRef.current.offsetWidth || 368,
        text: 'continue_with',
        shape: 'rectangular',
      })
      window.google.accounts.id.prompt()
    }

    if (window.google?.accounts) {
      initGoogle()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = initGoogle
    script.async = true
    document.head.appendChild(script)
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      if (mode === 'login') {
        const data = await login({ email: form.email, password: form.password })

        if (window.PasswordCredential) {
          const cred = new window.PasswordCredential({
            id: form.email,
            password: form.password,
            name: data.user.name || form.email,
          })
          navigator.credentials.store(cred)
        }

        onAuth(data.user)
      } else if (mode === 'register') {
        const data = await register({ name: form.name, email: form.email, password: form.password })

        if (window.PasswordCredential) {
          const cred = new window.PasswordCredential({
            id: form.email,
            password: form.password,
            name: data.user.name || form.email,
          })
          navigator.credentials.store(cred)
        }

        onAuth(data.user)
      } else if (mode === 'forgot') {
        await forgotPassword(form.email)
        setMode('forgot-sent')
      } else if (mode === 'reset') {
        await resetPassword(form.token, form.password)
        setMode('login')
        setError(null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function goLogin() {
    setMode('login')
    setError(null)
  }

  const showGoogleButton = mode === 'login' || mode === 'register'

  return (
    <AppFrame status="idle">
      <main className="center-page auth-page">
        <section className="empty-state">
          <div className="hero-eyebrow">Continuous AI sessions</div>
          <h1 className="hero-title">Start a protected streaming workspace.</h1>
          <p className="hero-copy">
            Sign in to plan, stream, pause, resume, and keep your run history attached to your account.
          </p>
        </section>

        <form className="auth-panel panel" onSubmit={submit}>
          <div className="panel-inner stack">
            {mode === 'forgot-sent' ? (
              <>
                <div>
                  <h2 className="run-title">Check your email</h2>
                  <p className="run-note">A reset link is on its way — it expires in 1 hour.</p>
                </div>
                <button type="button" className="button button-ghost full-width" onClick={goLogin}>
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <div>
                  <h2 className="run-title">
                    {mode === 'login' && 'Sign in'}
                    {mode === 'register' && 'Create account'}
                    {mode === 'forgot' && 'Reset password'}
                    {mode === 'reset' && 'Set new password'}
                  </h2>
                  <p className="run-note">One shell, one stream, one place to steer the run.</p>
                </div>

                {showGoogleButton && (
                  <>
                    <div ref={googleBtnRef} className="google-btn-wrap" />
                    <div className="auth-divider"><span>or</span></div>
                  </>
                )}

                {mode === 'register' && (
                  <input
                    className="form-field"
                    name="name"
                    autoComplete="name"
                    placeholder="Name"
                    value={form.name}
                    onChange={set('name')}
                  />
                )}

                {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                  <input
                    className="form-field"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="Email"
                    value={form.email}
                    onChange={set('email')}
                    required
                  />
                )}

                {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                  <input
                    className="form-field"
                    type="password"
                    name="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder={mode === 'reset' ? 'New password' : 'Password'}
                    value={form.password}
                    onChange={set('password')}
                    required
                  />
                )}

                {error && <p className="form-error">{error}</p>}

                <button className="button button-primary full-width" type="submit" disabled={busy}>
                  {mode === 'login'    && <><LogIn size={16} /> Sign in</>}
                  {mode === 'register' && <><UserPlus size={16} /> Create account</>}
                  {mode === 'forgot'   && <><Mail size={16} /> Send reset link</>}
                  {mode === 'reset'    && <><KeyRound size={16} /> Set new password</>}
                </button>

                {mode === 'login' && (
                  <button
                    type="button"
                    className="button button-ghost full-width"
                    onClick={() => { setMode('forgot'); setError(null) }}
                  >
                    Forgot password?
                  </button>
                )}

                {(mode === 'forgot' || mode === 'reset') && (
                  <button type="button" className="button button-ghost full-width" onClick={goLogin}>
                    Back to sign in
                  </button>
                )}

                {(mode === 'login' || mode === 'register') && (
                  <button
                    type="button"
                    className="button button-ghost full-width"
                    onClick={() => {
                      setMode((value) => value === 'login' ? 'register' : 'login')
                      setError(null)
                    }}
                  >
                    {mode === 'login' ? 'Create an account' : 'Back to sign in'}
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </main>
    </AppFrame>
  )
}
