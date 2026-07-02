import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock } from 'lucide-react'
import { useAuth } from './useAuth'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 bgGrid"
      style={{ background: 'var(--off-white)' }}
    >
      {/* Logo lockup above card */}
      <img
        src="/logo-lockup-onLight.svg"
        alt="Yippie"
        className="mb-8 object-contain mx-auto" style={{ width: 480 }}
      />

      {/* Card */}
      <div
        className="w-full bg-white"
        style={{
          maxWidth: 400,
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '32px',
        }}
      >
        <p
          className="font-mono text-[12px] font-semibold mb-3"
          style={{ color: 'var(--brand-deep)' }}
        >
          // Sign in
        </p>
        <h1
          className="font-display font-bold mb-6"
          style={{ fontSize: 26, letterSpacing: '-0.02em', color: 'var(--ink)' }}
        >
          Welcome back
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div
              className="rounded-md px-4 py-3 text-sm"
              style={{
                background: 'var(--status-urgent-bg)',
                border: '1px solid rgba(220,38,38,0.2)',
                color: 'var(--status-urgent)',
              }}
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>
              Email
            </label>
            <div className="relative">
              <Mail
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border outline-none transition-shadow"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = 'var(--ring-brand)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none' }}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-subtle)' }}>
              Password
            </label>
            <div className="relative">
              <Lock
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border outline-none transition-shadow"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--font-body)',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.boxShadow = 'var(--ring-brand)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 font-semibold text-sm text-white mt-1 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderRadius: 'var(--radius-sm)',
              background: loading ? 'var(--brand)' : 'var(--ink)',
              fontFamily: 'var(--font-body)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--brand)' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--ink)' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <Link
            to="/forgot-password"
            className="text-sm text-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e: any) => { e.currentTarget.style.color = 'var(--text-subtle)' }}
            onMouseLeave={(e: any) => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            Forgot password?
          </Link>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <a
              href="https://getyippie.com"
              className="underline transition-colors"
              style={{ color: 'var(--text-subtle)' }}
            >
              Request access
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
