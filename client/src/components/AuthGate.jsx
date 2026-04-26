import { useState } from 'react'
import { LogIn, UserPlus } from 'lucide-react'
import { login, register } from '../api/authApi.js'
import AppFrame from './AppFrame.jsx'

export default function AuthGate({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (key) => (e) => setForm((value) => ({ ...value, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const data = mode === 'login'
        ? await login({ email: form.email, password: form.password })
        : await register({ name: form.name, email: form.email, password: form.password })
      onAuth(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

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
            <div>
              <h2 className="run-title">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
              <p className="run-note">One shell, one stream, one place to steer the run.</p>
            </div>

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
            <input
              className="form-field"
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Password"
              value={form.password}
              onChange={set('password')}
              required
            />

            {error && <p className="form-error">{error}</p>}

            <button className="button button-primary full-width" type="submit" disabled={busy}>
              {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>

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
          </div>
        </form>
      </main>
    </AppFrame>
  )
}
