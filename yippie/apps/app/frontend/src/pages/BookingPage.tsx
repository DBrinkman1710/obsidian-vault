import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
          <div className="inline-flex items-center gap-2">
            <svg viewBox="0 0 36 36" className="w-7 h-7" fill="#5BA4F5">
              <circle cx="10" cy="8" r="4" />
              <path d="M4 28 Q10 36 18 30" strokeWidth="3.5" stroke="#5BA4F5" fill="none" strokeLinecap="round" />
              <circle cx="21" cy="5" r="2.5" />
            </svg>
            <span className="text-xl font-bold text-slate-900">yippie</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
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
  const [success, setSuccess] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery<PublicBooking>({
    queryKey: ['public-booking', token],
    queryFn: () => api.get(`/public/booking/${token}`).then(r => r.data),
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

  const showProposals = data.mode === 'propose' && !showPicker && (data.proposed_slots?.length ?? 0) > 0
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
          {data.proposed_slots!.map(slot => (
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
        </div>
      )}

      {(!showProposals) && (
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
              className="w-full mt-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {confirming ? 'Booking…' : `Book ${fmtSlotLong(picked.start, picked.end)}`}
            </button>
          )}
        </div>
      )}
    </Shell>
  )
}
