import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../api/client'

interface Slot { start: string; end: string }
interface AvailableSlot extends Slot { available: boolean }
interface MeetInfo {
  tenant_name: string
  tenant_timezone: string
  available_slots: AvailableSlot[]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dateKey = (d: Date, tz: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const day = parts.find(p => p.type === 'day')!.value
  return `${y}-${m}-${day}`
}

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

function fmtTime(iso: string, tz: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
}
function fmtSlotLong(start: string, end: string, tz: string) {
  const d = new Date(start)
  const day = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
  return `${day}, ${fmtTime(start, tz)}–${fmtTime(end, tz)}`
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <img
            src="/logo-lockup-onLight.svg"
            alt="Yippie"
            className="w-56 mx-auto object-contain"
          />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function MeetPage() {
  const { slug } = useParams<{ slug: string }>()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [picked, setPicked] = useState<Slot | null>(null)

  // Contact form step
  const [step, setStep] = useState<'pick' | 'details'>('pick')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { data, isLoading, isError } = useQuery<MeetInfo>({
    queryKey: ['public-meet', slug],
    queryFn: () => api.get(`/public/meet/${slug}`).then((r: any) => r.data),
    retry: false,
    enabled: !!slug,
  })

  const tz = data?.tenant_timezone ?? 'Europe/Amsterdam'
  const days = useMemo(() => monthGrid(year, month), [year, month])
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(today, tz)

  const slotsByDay = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>()
    for (const s of data?.available_slots ?? []) {
      const key = dateKey(new Date(s.start), tz)
      const list = map.get(key) ?? []
      list.push(s)
      map.set(key, list)
    }
    return map
  }, [data])

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!picked || !slug) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await api.post(`/public/meet/${slug}`, {
        name: name.trim(),
        email: email.trim(),
        slot_start: picked.start,
        slot_end: picked.end,
        message: message.trim() || null,
      })
      setSuccess(true)
    } catch (e: any) {
      setSubmitError(e?.response?.data?.detail || 'Could not book this time. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <Shell><p className="text-sm text-slate-400 text-center">Loading…</p></Shell>
  }

  if (isError || !data) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-900 mb-2">Page not found</h1>
          <p className="text-sm text-slate-500">This booking page is not available.</p>
        </div>
      </Shell>
    )
  }

  if (success) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">You're booked!</h1>
          <p className="text-sm text-slate-500 mb-1">
            {picked ? fmtSlotLong(picked.start, picked.end, tz) : ''}
          </p>
          <p className="text-sm text-slate-500">Check your email for confirmation.</p>
        </div>
      </Shell>
    )
  }

  const dayChips = activeDay ? slotsByDay.get(activeDay) ?? [] : []

  // Step 2 — contact details
  if (step === 'details' && picked) {
    return (
      <Shell>
        <button
          onClick={() => { setStep('pick'); setSubmitError(null) }}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4"
        >
          ← Back
        </button>
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{data.tenant_name}</p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">Confirm your booking</h1>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {fmtSlotLong(picked.start, picked.end, tz)}
          </p>
        </div>

        <form onSubmit={handleBook} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="meet-name">
              Your name
            </label>
            <input
              id="meet-name"
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={submitting}
              placeholder="Jane Smith"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="meet-email">
              Email address
            </label>
            <input
              id="meet-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="jane@acme.com"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5" htmlFor="meet-msg">
              Message <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="meet-msg"
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={submitting}
              placeholder="Anything you'd like to discuss…"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie disabled:opacity-50 resize-none"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-500">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {submitting ? 'Booking…' : 'Confirm booking'}
          </button>
        </form>
      </Shell>
    )
  }

  // Step 1 — pick a slot
  return (
    <Shell>
      <div className="text-center mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{data.tenant_name}</p>
        <h1 className="text-xl font-bold text-slate-900 mt-1">Book a call</h1>
        <p className="text-sm text-slate-500 mt-1">Pick a time that works for you.</p>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-700">{monthLabel}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-100">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded text-slate-500 hover:bg-slate-100">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 px-2 pt-2">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 px-2 pb-2 gap-0.5">
          {days.map(day => {
            const key = dateKey(day, tz)
            const inMonth = day.getMonth() === month
            const isPastOrToday = key <= todayKey
            const hasSlots = (slotsByDay.get(key)?.length ?? 0) > 0
            const isActive = key === activeDay
            const disabled = isPastOrToday || !hasSlots
            return (
              <button
                key={key}
                disabled={disabled}
                onClick={() => { setActiveDay(key); setPicked(null) }}
                className={`h-9 text-xs rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white font-bold'
                    : disabled ? 'text-slate-300 cursor-not-allowed'
                    : inMonth ? 'text-slate-700 font-medium hover:bg-blue-50'
                    : 'text-slate-400 hover:bg-slate-50'}`}
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      {activeDay && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">Available times</p>
          <div className="flex flex-wrap gap-1.5">
            {dayChips.map(chip => {
              const isPicked = picked?.start === chip.start
              return (
                <button
                  key={chip.start}
                  disabled={!chip.available}
                  onClick={() => setPicked({ start: chip.start, end: chip.end })}
                  className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                    !chip.available
                      ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed line-through'
                      : isPicked
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                >
                  {fmtTime(chip.start, tz)}
                </button>
              )
            })}
            {dayChips.length === 0 && <p className="text-xs text-slate-400">No times for this day.</p>}
          </div>
        </div>
      )}

      {picked && (
        <button
          onClick={() => setStep('details')}
          className="w-full mt-5 py-2.5 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
        >
          Continue: {fmtSlotLong(picked.start, picked.end, tz)}
        </button>
      )}
    </Shell>
  )
}
