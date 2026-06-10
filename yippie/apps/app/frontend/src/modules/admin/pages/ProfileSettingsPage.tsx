import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth()
  const [replyFromEmail, setReplyFromEmail] = useState(user?.reply_from_email ?? '')
  const [inboundEmail, setInboundEmail] = useState(user?.inbound_email ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.patch('/auth/me', {
      reply_from_email: replyFromEmail.trim() || null,
      inbound_email: inboundEmail.trim() || null,
    }).then(r => r.data),
    onSuccess: async () => {
      await refreshUser()
      setSaved(true)
      setError('')
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to save — try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    setError('')
    mutation.mutate()
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Profile</h1>
      <p className="text-sm text-slate-500 mb-8">Manage your personal reply address and display name.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
          <p className="text-sm text-slate-700">{user?.email}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            Personal reply-from address
          </label>
          <input
            type="email"
            value={replyFromEmail}
            onChange={e => setReplyFromEmail(e.target.value)}
            placeholder="e.g. eddy-klimaatexamen-support@getyippie.com"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            When set, you can choose this address as the "From" when replying or composing. Must be on a Resend-verified domain (e.g. @getyippie.com).
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            Personal inbox address
          </label>
          <input
            type="email"
            value={inboundEmail}
            onChange={e => setInboundEmail(e.target.value)}
            placeholder="e.g. klimaatexamen-eddy@getyippie.com"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Mail sent (or forwarded) to this @getyippie.com address lands in your Personal inbox instead of the team's shared one. Set up forwarding from your work email to this address.
          </p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
        </div>
      </form>

      <ChangePasswordCard />
    </div>
  )
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.patch('/auth/me/password', { current_password: current, new_password: next }).then(r => r.data),
    onSuccess: () => {
      setSaved(true)
      setError('')
      setCurrent(''); setNext(''); setConfirm('')
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to change password.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setError('Passwords do not match'); return }
    setSaved(false)
    setError('')
    mutation.mutate()
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 mt-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Change password</h2>
        <p className="text-xs text-slate-400 mt-0.5">At least 8 characters.</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Current password</label>
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className={inputCls} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">New password</label>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} className={inputCls} required minLength={8} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Confirm new password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} required />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          {mutation.isPending ? 'Updating…' : 'Update password'}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Password updated</span>}
      </div>
    </form>
  )
}
