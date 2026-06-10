import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { AuthShell, authButtonCls, authInputCls, authLabelCls } from './AuthShell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
    } finally {
      // Always show the same confirmation — never reveal whether the email exists
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <AuthShell subtitle="Reset your password">
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            If an account exists for <span className="font-semibold">{email}</span>, a reset link is on its way. The link is valid for 1 hour.
          </p>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">← Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>Email</label>
            <input type="email" placeholder="you@company.com" value={email}
              onChange={e => setEmail(e.target.value)} className={authInputCls} required autoFocus />
          </div>
          <button type="submit" disabled={loading} className={authButtonCls}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <Link to="/login" className="text-sm text-slate-400 hover:text-slate-600 text-center">← Back to sign in</Link>
        </form>
      )}
    </AuthShell>
  )
}
