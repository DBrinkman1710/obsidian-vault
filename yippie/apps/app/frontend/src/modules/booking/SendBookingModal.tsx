import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../api/client'

interface CalendarSettings {
  work_start_hour: number
  work_end_hour: number
  slot_minutes: number
  booking_expiry_days: number
}

interface SlotProposal { start: string; end: string }

interface Props {
  contacts: { id: string; full_name: string }[]
  bulk?: boolean
  open: boolean
  onClose: () => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Monday-start grid: 6 full weeks covering the given month. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

function fmtSlot(start: Date, end: Date): string {
  const day = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const t = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${t(start)}–${t(end)}`
}

export default function SendBookingModal({ contacts, bulk = false, open, onClose }: Props) {
  const today = new Date()
  const [mode, setMode] = useState<'open' | 'propose'>('open')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotProposal[]>([])

  const { data: settings } = useQuery<CalendarSettings>({
    queryKey: ['booking-settings'],
    queryFn: () => api.get('/booking/settings').then(r => r.data),
    enabled: open,
  })

  const days = useMemo(() => monthGrid(year, month), [year, month])
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(today)

  // Build the time chips for the active day from the tenant's work hours.
  const dayChips = useMemo(() => {
    if (!activeDay || !settings) return []
    const [y, m, d] = activeDay.split('-').map(Number)
    const step = settings.slot_minutes
    const out: SlotProposal[] = []
    let cursor = new Date(y, m - 1, d, settings.work_start_hour, 0, 0)
    const end = new Date(y, m - 1, d, settings.work_end_hour, 0, 0)
    while (cursor.getTime() + step * 60000 <= end.getTime()) {
      const slotStart = new Date(cursor)
      const slotEnd = new Date(cursor.getTime() + step * 60000)
      out.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() })
      cursor = slotEnd
    }
    return out
  }, [activeDay, settings])

  function shiftMonth(delta: number) {
    const dt = new Date(year, month + delta, 1)
    setYear(dt.getFullYear()); setMonth(dt.getMonth())
  }

  function toggleSlot(slot: SlotProposal) {
    setSlots(prev =>
      prev.some(s => s.start === slot.start)
        ? prev.filter(s => s.start !== slot.start)
        : [...prev, slot])
  }

  async function handleSend() {
    if (contacts.length === 0) return
    const useMode = bulk ? 'open' : mode
    if (useMode === 'propose' && slots.length === 0) {
      toast.error('Add at least one proposed time first.')
      return
    }
    setSending(true)
    try {
      const payload = {
        mode: useMode,
        message: message.trim() || undefined,
        proposed_slots: useMode === 'propose'
          ? slots.map(s => ({ start: s.start, end: s.end }))
          : undefined,
      }
      await Promise.all(
        contacts.map(c => api.post('/booking/send', { ...payload, contact_id: c.id })),
      )
      toast.success('Booking link sent!')
      reset()
      onClose()
    } catch {
      toast.error('Could not send booking link. Please try again.')
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setMode('open'); setMessage(''); setSlots([]); setActiveDay(null)
    setYear(today.getFullYear()); setMonth(today.getMonth())
  }

  if (!open) return null

  const sendingTo = bulk
    ? `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`
    : contacts[0]?.full_name ?? '—'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">Send booking link</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Sending to: <span className="font-semibold text-slate-900">{sendingTo}</span>
          </p>

          {!bulk && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode('open')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                  mode === 'open'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                Customer picks time
              </button>
              <button
                onClick={() => setMode('propose')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                  mode === 'propose'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                Propose times
              </button>
            </div>
          )}

          {!bulk && mode === 'propose' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-700">{monthLabel}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => shiftMonth(-1)} className="p-1 rounded text-slate-500 hover:bg-slate-100">
                    <ChevronLeft size={15} />
                  </button>
                  <button onClick={() => shiftMonth(1)} className="p-1 rounded text-slate-500 hover:bg-slate-100">
                    <ChevronRight size={15} />
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
                  const isPast = key < todayKey
                  const isActive = key === activeDay
                  return (
                    <button
                      key={key}
                      disabled={isPast}
                      onClick={() => setActiveDay(key)}
                      className={`h-8 text-xs rounded-lg transition-colors ${
                        isActive ? 'bg-blue-600 text-white font-bold'
                          : isPast ? 'text-slate-300 cursor-not-allowed'
                          : inMonth ? 'text-slate-700 hover:bg-slate-100'
                          : 'text-slate-300 hover:bg-slate-50'}`}
                    >
                      {day.getDate()}
                    </button>
                  )
                })}
              </div>

              {activeDay && (
                <div className="px-3 py-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">Tap to add times</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dayChips.map(chip => {
                      const selected = slots.some(s => s.start === chip.start)
                      return (
                        <button
                          key={chip.start}
                          onClick={() => toggleSlot(chip)}
                          className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                            selected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                          {new Date(chip.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                        </button>
                      )
                    })}
                    {dayChips.length === 0 && (
                      <p className="text-xs text-slate-400">No slots for this day.</p>
                    )}
                  </div>
                </div>
              )}

              {slots.length > 0 && (
                <div className="px-3 py-3 border-t border-slate-100">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">
                    Proposed ({slots.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {slots
                      .slice()
                      .sort((a, b) => a.start.localeCompare(b.start))
                      .map(s => (
                        <span key={s.start}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md">
                          {fmtSlot(new Date(s.start), new Date(s.end))}
                          <button onClick={() => toggleSlot(s)} className="hover:text-blue-900">
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Add a short note for the customer…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-vertical min-h-[70px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={handleSend}
            disabled={sending || contacts.length === 0}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {sending ? 'Sending…' : 'Send booking link'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
