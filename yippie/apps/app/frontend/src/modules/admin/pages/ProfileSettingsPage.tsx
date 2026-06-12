import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth()
  const [personalEmail, setPersonalEmail] = useState(user?.inbound_email ?? user?.reply_from_email ?? '')
  const [signature, setSignature] = useState(user?.email_signature ?? '')
  const [hotkeysEnabled, setHotkeysEnabled] = useState(user?.hotkeys_enabled !== false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    // One personal address does both: outbound "from" and inbound routing
    mutationFn: () => api.patch('/auth/me', {
      reply_from_email: personalEmail.trim() || null,
      inbound_email: personalEmail.trim() || null,
      email_signature: signature.trim() || null,
      hotkeys_enabled: hotkeysEnabled,
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
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Profile</h1>
      <p className="text-sm text-slate-500 mb-8">Manage your personal email address, signature and password.</p>

      {/* Top: email + personal address + hotkeys */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 mb-6">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
          <p className="text-sm text-slate-700">{user?.email}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Personal email address</label>
          <input
            type="email"
            value={personalEmail}
            onChange={e => setPersonalEmail(e.target.value)}
            placeholder="e.g. eddy@getyippie.com"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            One address for both directions: mail sent to it lands in your Personal inbox, and you can pick it as the "From" address when replying or composing.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-slate-100 pt-5">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Keyboard shortcuts</label>
            <p className="text-xs text-slate-400 max-w-sm">
              When on, shortcuts like <span className="font-medium text-slate-500">Cmd/Ctrl + Enter</span> to send are active. Turn off to disable all keyboard shortcuts.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hotkeysEnabled}
            onClick={() => setHotkeysEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${hotkeysEnabled ? 'bg-yippie' : 'bg-slate-300'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hotkeysEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
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

      {/* Bottom two columns: signature (left) + change password (right, narrower) */}
      <div className="grid grid-cols-[1fr_280px] gap-6 items-start">
        {/* Signature */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 mb-0.5">Email signature</h2>
            <p className="text-xs text-slate-400">Added automatically below your message when you compose or reply.</p>
          </div>
          <textarea
            value={signature}
            onChange={e => setSignature(e.target.value)}
            rows={5}
            placeholder={'e.g.\nBest regards,\nEddy — Support Team'}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie resize-y"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {mutation.isPending ? 'Saving…' : 'Save signature'}
            </button>
            {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
          </div>
        </form>

        {/* Change password */}
        <ChangePasswordCard />
      </div>
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
