import { useState } from 'react'
import './AuthDialog.css'

function AuthDialog({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function submitForm(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    setSubmitting(true)

    try {
      const isLogin = mode === 'login'
      const headers = { 'Content-Type': 'application/json' }

      if (isLogin) {
        const csrfResponse = await fetch('/api/v1/auth/csrf', {
          credentials: 'include',
        })

        if (!csrfResponse.ok) {
          throw new Error('Could not get a security token. Please try again.')
        }

        const csrf = await csrfResponse.json()
        headers[csrf.headerName || 'X-CSRF-TOKEN'] = csrf.token
      }

      const endpoint = isLogin
        ? '/api/v1/auth/login'
        : '/api/v1/auth/register'

      const body = isLogin
        ? { email: form.email, password: form.password }
        : {
            fullName: form.fullName,
            email: form.email,
            password: form.password,
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      })

      const responseText = await response.text()
      let result = {}

      try {
        result = responseText ? JSON.parse(responseText) : {}
      } catch {
        result = {}
      }

      if (!response.ok) {
        if (isLogin && response.status === 401) {
          throw new Error(
            "Email or password is incorrect. If you haven't created an account yet, choose Create account first.",
          )
        }

        throw new Error(
          result.detail ||
            result.message ||
            result.error ||
            'The request could not be completed.',
        )
      }

      if (isLogin) {
        onAuthenticated(result)
      } else {
        setMode('login')
        setForm({ ...form, password: '' })
        setMessage(
          'Account created. Sign in with your new email and password.',
        )
      }
    } catch (requestError) {
      setError(
        requestError.message || 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-backdrop" onMouseDown={onClose}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="auth-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <p className="auth-eyebrow">WELCOME TO ANUH</p>
        <h2 id="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="auth-intro">
          {mode === 'login'
            ? 'Sign in to continue to your Anuh collection.'
            : 'Join us to save favourites and continue to checkout.'}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'selected' : ''}
            onClick={() => {
              setMode('login')
              setError('')
              setMessage('')
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'selected' : ''}
            onClick={() => {
              setMode('register')
              setError('')
              setMessage('')
            }}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={submitForm}>
          {mode === 'register' && (
            <label>
              Full name
              <input
                name="fullName"
                type="text"
                autoComplete="name"
                maxLength="120"
                required
                value={form.fullName}
                onChange={updateField}
              />
            </label>
          )}

          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength="255"
              required
              value={form.email}
              onChange={updateField}
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              minLength={mode === 'register' ? 12 : undefined}
              maxLength="72"
              required
              value={form.password}
              onChange={updateField}
            />
            {mode === 'register' && (
              <small>Use at least 12 characters.</small>
            )}
          </label>

          {message && <p className="auth-message">{message}</p>}
          {error && <p className="auth-error">{error}</p>}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? 'Please wait…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="auth-privacy">
          Your password is sent to your backend over the app connection and
          stored there as a secure hash.
        </p>
      </section>
    </div>
  )
}

export default AuthDialog
