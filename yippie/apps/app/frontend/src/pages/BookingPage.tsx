import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { api } from '../api/client'

interface Slot { start: string; end: string }
interface AvailableSlot extends Slot { available: boolean }
interface PublicBooking {
  tenant_name: string
  contact_first_name: string
  mode: 'open' | 'propose'
  proposed_slots: Slot[] | null
  message: string | null
  expires_at: string
  available_slots: AvailableSlot[]
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}
function fmtSlotLong(start: string, end: string) {
  const d = new Date(start)
  const day = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  return `${day}, ${fmtTime(start)}–${fmtTime(end)}`
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

// ---------------------------------------------------------------------------
// Counter-propose form
// ---------------------------------------------------------------------------

interface ProposedRow {
  date: string   // YYYY-MM-DD
  time: string   // HH:MM
  duration: number  // minutes: 30 | 60 | 90
}

function emptyRow(): ProposedRow {
  return { date: '', time: '', duration: 30 }
}

function CounterProposeForm({ onSuccess }: { onSuccess: () => void }) {
  const { token } = useParams<{ token: string }>()
  const [rows, setRows] = useState<ProposedRow[]>([emptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateRow(idx: number, patch: Partial<ProposedRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  function addRow() {
    if (rows.length < 3) setRows(prev => [...prev, emptyRow()])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const filled = rows.filter(r => r.date && r.time)
    if (filled.length === 0) {
      setError('Please fill in at least one date and time.')
      return
    }

    const slots = filled.map(r => {
      const start = new Date(`${r.date}T${r.time}:00`)
      const end = new Date(start.getTime() + r.duration * 60 * 1000)
      return { start: start.toISOString(), end: end.toISOString() }
    })

    setSubmitting(true)
    try {
      await api.post(`/public/booking/${token}/counter-propose`, { slots })
      onSuccess()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not send your proposal. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <p className="text-sm font-semibold text-slate-700 mb-3">Suggest up to 3 times that work for you</p>

      <div className="flex flex-col gap-3">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={row.date}
              onChange={e => updateRow(idx, { date: e.target.value })}
              className="flex-1 min-w-[130px] px-2.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="time"
              value={row.time}
              onChange={e => updateRow(idx, { time: e.target.value })}
              className="w-28 px-2.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <select
              value={row.duration}
              onChange={e => updateRow(idx, { duration: Number(e.target.value) })}
              className="w-24 px-2.5 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      {rows.length < 3 && (
        <button
          type="button"
          onClick={addRow}
          className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          + Add another time
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}

      <div className="flex items-center gap-3 mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
        >
          {submitting ? 'Sending…' : 'Send proposal'}
        </button>
      </div>
    </form>
  )
}

export default function BookingPage() {
  const { token } = useParams<{ token: string }>()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [picked, setPicked] = useState<Slot | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showCounterPropose, setShowCounterPropose] = useState(false)
  const [counterProposeSent, setCounterProposeSent] = useState(false)
  const [success, setSuccess] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery<PublicBooking>({
    queryKey: ['public-booking', token],
    queryFn: () => api.get(`/public/booking/${token}`).then((r: any) => r.data),
    retry: false,
    enabled: !!token,
  })

  const days = useMemo(() => monthGrid(year, month), [year, month])
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(today)

  // Group available slots by day for the picker.
  const slotsByDay = useMemo(() => {
    const map = new Map<string, AvailableSlot[]>()
    for (const s of data?.available_slots ?? []) {
      const key = dateKey(new Date(s.start))
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

  async function confirm(slot: Slot) {
    if (!token) return
    setConfirming(true)
    setConfirmError(null)
    try {
      await api.post(`/public/booking/${token}/confirm`, {
        slot_start: slot.start,
        slot_end: slot.end,
      })
      setSuccess(true)
    } catch (e: any) {
      setConfirmError(e?.response?.data?.detail || 'Could not confirm this time. Please pick another.')
    } finally {
      setConfirming(false)
    }
  }

  if (isLoading) {
    return <Shell><p className="text-sm text-slate-400 text-center">Loading…</p></Shell>
  }

  if (isError || !data) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-900 mb-2">Link unavailable</h1>
          <p className="text-sm text-slate-500">
            This booking link has expired or has already been used.
          </p>
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
          <h1 className="text-lg font-bold text-slate-900 mb-2">You&apos;re booked!</h1>
          <p className="text-sm text-slate-500">Check your email for confirmation.</p>
        </div>
      </Shell>
    )
  }

  if (counterProposeSent) {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Proposal sent!</h1>
          <p className="text-sm text-slate-500">
            Your proposed times have been sent to {data.tenant_name}. They&apos;ll get back to you shortly.
          </p>
        </div>
      </Shell>
    )
  }

  const showProposals = data.mode === 'propose' && !showPicker && !showCounterPropose && (data.proposed_slots?.length ?? 0) > 0
  const dayChips = activeDay ? slotsByDay.get(activeDay) ?? [] : []

  return (
    <Shell>
      <div className="text-center mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{data.tenant_name}</p>
        <h1 className="text-xl font-bold text-slate-900 mt-1">Book a meeting</h1>
        <p className="text-sm text-slate-500 mt-1">Hi {data.contact_first_name}, pick a time that works for you.</p>
      </div>

      {data.message && (
        <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 whitespace-pre-wrap">
          {data.message}
        </div>
      )}

      {confirmError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {confirmError}
        </div>
      )}

      {showProposals && (
        <div className="flex flex-col gap-3">
          {data.proposed_slots!.map((slot: any) => (
            <button
              key={slot.start}
              disabled={confirming}
              onClick={() => confirm(slot)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
            >
              <span className="text-sm font-semibold text-slate-800">{fmtSlotLong(slot.start, slot.end)}</span>
              <span className="text-xs font-semibold text-blue-600 shrink-0">Accept this time</span>
            </button>
          ))}
          <button
            onClick={() => setShowPicker(true)}
            className="text-sm text-slate-500 hover:text-blue-600 transition-colors mt-1"
          >
            None of these work? Pick your own time →
          </button>
          {data.mode === 'propose' && (
            <button
              onClick={() => setShowCounterPropose(true)}
              className="text-sm text-slate-500 hover:text-amber-600 transition-colors"
            >
              Propose your own times →
            </button>
          )}
        </div>
      )}

      {showCounterPropose && (
        <div>
          <button
            onClick={() => setShowCounterPropose(false)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3"
          >
            {data.mode === 'propose' ? '← Back to proposed times' : '← Back to available times'}
          </button>
          <CounterProposeForm
            onSuccess={() => setCounterProposeSent(true)}
          />
        </div>
      )}

      {(!showProposals && !showCounterPropose) && (
        <div>
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
                const key = dateKey(day)
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
                      {fmtTime(chip.start)}
                    </button>
                  )
                })}
                {dayChips.length === 0 && <p className="text-xs text-slate-400">No times for this day.</p>}
              </div>
            </div>
          )}

          {picked && (
            <button
              onClick={() => confirm(picked)}
              disabled={confirming}
              className="w-full mt-5 py-2.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              {confirming ? 'Booking…' : `Book ${fmtSlotLong(picked.start, picked.end)}`}
            </button>
          )}

          <button
            onClick={() => setShowCounterPropose(true)}
            className="w-full mt-3 text-sm text-slate-500 hover:text-amber-600 transition-colors"
          >
            None of these times work? Propose your own →
          </button>
        </div>
      )}
    </Shell>
  )
}
