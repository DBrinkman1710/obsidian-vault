import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

interface CalendarSettings {
  work_start_hour: number
  work_end_hour: number
  slot_minutes: number
  booking_expiry_days: number
}

interface PipelineStage { id: string; name: string }
interface SlotProposal { start: string; end: string }
interface ContactOption { id: string; full_name: string; email?: string | null }

interface Props {
  contacts?: { id: string; full_name: string }[]
  bulk?: boolean
  open: boolean
  onClose: () => void
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

function fmtSlot(start: Date, end: Date): string {
  const day = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const t = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${t(start)}–${t(end)}`
}

/** Smart default for "Propose times": the next `count` upcoming working-hour
 * slots from now, so the sender starts with sensible options already filled in
 * rather than a blank calendar. ISO strings match the calendar chips exactly so
 * the prefilled slots render as selected. */
function computeNextSlots(settings: CalendarSettings, count: number): SlotProposal[] {
  const now = Date.now()
  const step = settings.slot_minutes
  const out: SlotProposal[] = []
  const cursorDay = new Date()
  for (let d = 0; d < 21 && out.length < count; d++) {
    const day = new Date(cursorDay.getFullYear(), cursorDay.getMonth(), cursorDay.getDate() + d)
    let cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), settings.work_start_hour, 0, 0)
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), settings.work_end_hour, 0, 0)
    while (cursor.getTime() + step * 60000 <= end.getTime() && out.length < count) {
      const slotEnd = new Date(cursor.getTime() + step * 60000)
      if (cursor.getTime() > now) {
        out.push({ start: cursor.toISOString(), end: slotEnd.toISOString() })
      }
      cursor = slotEnd
    }
  }
  return out
}

export default function SendBookingModal({ contacts = [], bulk = false, open, onClose }: Props) {
  const today = new Date()
  const user = useAuth((s: any) => s.user)
  const [mode, setMode] = useState<'open' | 'propose'>('open')
  const [message, setMessage] = useState('')
  const [stageIdOverride, setStageIdOverride] = useState<string>('')
  const [sendFromPersonal, setSendFromPersonal] = useState(false)
  const [sending, setSending] = useState(false)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [slots, setSlots] = useState<SlotProposal[]>([])

  // Contact picker — shown when no contacts are pre-provided
  const [pickedContact, setPickedContact] = useState<ContactOption | null>(null)
  const [contactQuery, setContactQuery] = useState('')
  const [contactDropOpen, setContactDropOpen] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)

  const needsPicker = contacts.length === 0 && !bulk
  const effectiveContacts = needsPicker
    ? (pickedContact ? [pickedContact] : [])
    : contacts

  const { data: settings } = useQuery<CalendarSettings>({
    queryKey: ['booking-settings'],
    queryFn: () => api.get('/booking/settings').then((r: any) => r.data),
    enabled: open,
  })

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
    enabled: open,
  })

  const { data: contactResults, isFetching: searchingContacts } = useQuery<ContactOption[]>({
    queryKey: ['booking-contact-search', contactQuery],
    queryFn: () => api.get('/contacts', { params: { search: contactQuery, limit: 10 } })
      .then((r: any) => r.data.items.map((c: any) => ({ id: c.id, full_name: c.full_name, email: c.email }))),
    enabled: needsPicker && contactQuery.trim().length > 0,
  })

  const days = useMemo(() => monthGrid(year, month), [year, month])
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(today)

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

  function enterProposeMode() {
    setMode('propose')
    // Prefill the next 3 free slots the first time the user opens propose mode,
    // and focus the calendar on that day so they show as selected.
    if (slots.length === 0 && settings) {
      const suggested = computeNextSlots(settings, 3)
      if (suggested.length > 0) {
        setSlots(suggested)
        const first = new Date(suggested[0].start)
        setActiveDay(dateKey(first))
        setYear(first.getFullYear())
        setMonth(first.getMonth())
      }
    }
  }

  function toggleSlot(slot: SlotProposal) {
    setSlots(prev =>
      prev.some(s => s.start === slot.start)
        ? prev.filter(s => s.start !== slot.start)
        : [...prev, slot])
  }

  async function handleSend() {
    if (effectiveContacts.length === 0) {
      toast.error('Please select a contact first.')
      return
    }
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
        stage_id_override: stageIdOverride || undefined,
        from_email: sendFromPersonal && user?.reply_from_email ? user.reply_from_email : undefined,
      }
      await Promise.all(
        effectiveContacts.map(c => api.post('/booking/send', { ...payload, contact_id: c.id })),
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
    setMode('open'); setMessage(''); setStageIdOverride(''); setSendFromPersonal(false); setSlots([]); setActiveDay(null)
    setYear(today.getFullYear()); setMonth(today.getMonth())
    setPickedContact(null); setContactQuery('')
  }

  if (!open) return null

  const sendingTo = bulk
    ? `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`
    : effectiveContacts[0]?.full_name ?? null

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
          {/* Contact picker — only when no contact pre-selected */}
          {needsPicker && (
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Contact *
              </label>
              {pickedContact ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50">
                  <span className="text-slate-800 truncate">
                    {pickedContact.full_name}{pickedContact.email ? ` (${pickedContact.email})` : ''}
                  </span>
                  <button type="button"
                    onClick={() => { setPickedContact(null); setContactQuery('') }}
                    className="text-slate-400 hover:text-slate-600 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search contacts…"
                  value={contactQuery}
                  onChange={e => { setContactQuery(e.target.value); setContactDropOpen(true) }}
                  onFocus={() => setContactDropOpen(true)}
                  onBlur={() => { blurTimer.current = window.setTimeout(() => setContactDropOpen(false), 150) }}
                  autoFocus
                />
              )}
              {contactDropOpen && !pickedContact && contactQuery.trim().length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-44 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                  {searchingContacts ? (
                    <p className="px-3 py-2 text-sm text-slate-400">Searching…</p>
                  ) : (contactResults ?? []).length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
                  ) : (contactResults ?? []).map((c: any) => (
                    <button key={c.id} type="button"
                      onMouseDown={() => {
                        window.clearTimeout(blurTimer.current)
                        setPickedContact(c)
                        setContactDropOpen(false)
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 truncate">
                      {c.full_name}{c.email ? ` (${c.email})` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sending-to label — when contact is pre-selected */}
          {!needsPicker && sendingTo && (
            <p className="text-sm text-slate-600">
              Sending to: <span className="font-semibold text-slate-900">{sendingTo}</span>
            </p>
          )}

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
                onClick={enterProposeMode}
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

          {stages.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Move to stage after booking (optional)
              </label>
              <select
                value={stageIdOverride}
                onChange={e => setStageIdOverride(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">— Use default —</option>
                {stages.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {user?.reply_from_email && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sendFromPersonal}
                onChange={e => setSendFromPersonal(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-slate-700 font-medium">
                Send from <span className="text-slate-500 font-normal">{user.reply_from_email}</span>
              </span>
            </label>
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
            disabled={sending || effectiveContacts.length === 0}
            className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
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
