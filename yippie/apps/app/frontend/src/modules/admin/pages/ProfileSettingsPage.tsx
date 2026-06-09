import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth()
  const [replyFromEmail, setReplyFromEmail] = useState(user?.reply_from_email ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.patch('/auth/me', { reply_from_email: replyFromEmail.trim() || null }).then(r => r.data),
    onSuccess: async () => {
      await refreshUser()
      setSaved(true)
      setError('')
      setTimeout(() => setSaved(false), 3000)
    },
    onError: () => setError('Failed to save — try again.'),
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
    </div>
  )
}
