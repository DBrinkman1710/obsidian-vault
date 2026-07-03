import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { AuthShell, authButtonCls, authErrorCls, authInputCls, authLabelCls } from './AuthShell'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setDone(true)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell subtitle="Reset your password">
        <p className="text-sm text-slate-500">
          This page only works via a reset link. <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700">Request a new one.</Link>
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell subtitle="Choose a new password">
      {done ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">Your password has been updated.</p>
          <Link to="/login" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Sign in →</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className={authErrorCls}>{error}</div>}
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>New password</label>
            <input type="password" placeholder="At least 8 characters" value={password}
              onChange={e => setPassword(e.target.value)} className={authInputCls} required minLength={8} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={authLabelCls}>Confirm password</label>
            <input type="password" placeholder="••••••••" value={confirm}
              onChange={e => setConfirm(e.target.value)} className={authInputCls} required />
          </div>
          <button type="submit" disabled={loading} className={authButtonCls}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
