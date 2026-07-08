import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, X, CheckCircle2 } from 'lucide-react'
import { api } from '../api/client'

interface RequestInfo {
  tenant_name: string
  min_notice_days: number
  booking_window_days: number
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <img src="/logo-lockup-onLight.svg" alt="Yippie" className="w-56 mx-auto object-contain" />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

// datetime-local string (local time, no tz) -> ISO with the browser's offset.
function toIso(local: string): string {
  return new Date(local).toISOString()
}

export default function RequestPage() {
  const { slug } = useParams<{ slug: string }>()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [slots, setSlots] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { data, isLoading, isError } = useQuery<RequestInfo>({
    queryKey: ['public-request', slug],
    queryFn: () => api.get(`/public/request/${slug}`).then((r: any) => r.data),
    retry: false,
    enabled: !!slug,
  })

  function setSlot(i: number, v: string) {
    setSlots(prev => prev.map((s, idx) => (idx === i ? v : s)))
  }
  function addSlot() {
    if (slots.length < 5) setSlots(prev => [...prev, ''])
  }
  function removeSlot(i: number) {
    setSlots(prev => prev.filter((_, idx) => idx !== i))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const filled = slots.filter(Boolean)
    if (!name.trim() || !email.trim() || filled.length === 0) {
      setError('Please add your name, email and at least one preferred time.')
      return
    }
    // Each requested slot is a 1-hour window starting at the chosen time.
    const requested_slots = filled.map(local => {
      const start = new Date(local)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      return { start: toIso(local), end: end.toISOString() }
    })
    setSubmitting(true)
    try {
      await api.post(`/public/request/${slug}`, {
        name: name.trim(),
        email: email.trim(),
        message: message.trim() || undefined,
        requested_slots,
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return <Shell><p className="text-sm text-slate-400 text-center">Loading…</p></Shell>
  if (isError || !data) {
    return (
      <Shell>
        <p className="text-center text-slate-700 font-medium">This request page isn't available.</p>
        <p className="text-center text-sm text-slate-400 mt-1">The organisation may not be accepting requests right now.</p>
      </Shell>
    )
  }
  if (success) {
    return (
      <Shell>
        <div className="text-center py-4">
          <CheckCircle2 className="h-12 w-12 text-yippie mx-auto mb-3" />
          <h1 className="font-display text-xl font-bold text-ink">Request sent</h1>
          <p className="text-sm text-slate-500 mt-2">
            Thanks! {data.tenant_name} will confirm a time with you by email shortly.
          </p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="font-display text-xl font-bold text-ink">Request an appointment</h1>
      <p className="text-sm text-slate-500 mt-1">
        Tell {data.tenant_name} when suits you. They'll confirm a time by email.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40 focus:border-yippie"
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Your email"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40 focus:border-yippie"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Preferred time(s)</label>
          <div className="space-y-2">
            {slots.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={s}
                  onChange={e => setSlot(i, e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40 focus:border-yippie"
                />
                {slots.length > 1 && (
                  <button type="button" onClick={() => removeSlot(i)} className="p-2 text-slate-400 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {slots.length < 5 && (
            <button type="button" onClick={addSlot} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80">
              <Plus className="h-3 w-3" /> Add another option
            </button>
          )}
        </div>

        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Anything we should know? (optional)"
          rows={3}
          className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40 focus:border-yippie"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
        >
          {submitting ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </Shell>
  )
}
