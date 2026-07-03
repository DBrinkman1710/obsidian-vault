import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from './useAuth'
import { AuthShell, authButtonCls, authErrorCls, authInputCls, authLabelCls } from './AuthShell'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { setSession } = useAuth()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/register', { token, password, full_name: fullName || undefined })
      setSession(data.user)
      navigate('/inbox')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Registration failed. The invite link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell subtitle="Activate your account">
        <p className="text-sm text-slate-500">
          This page only works via an invite link. Check your email for an invitation, or ask your admin to send a new one.
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="Set a password to activate your account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <div className={authErrorCls}>{error}</div>}
        <div className="flex flex-col gap-1.5">
          <label className={authLabelCls}>Your name</label>
          <input type="text" placeholder="Alex Johnson" value={fullName}
            onChange={e => setFullName(e.target.value)} className={authInputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={authLabelCls}>Password</label>
          <input type="password" placeholder="At least 8 characters" value={password}
            onChange={e => setPassword(e.target.value)} className={authInputCls} required minLength={8} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={authLabelCls}>Confirm password</label>
          <input type="password" placeholder="••••••••" value={confirm}
            onChange={e => setConfirm(e.target.value)} className={authInputCls} required />
        </div>
        <button type="submit" disabled={loading} className={authButtonCls}>
          {loading ? 'Creating account…' : 'Activate account'}
        </button>
      </form>
    </AuthShell>
  )
}
