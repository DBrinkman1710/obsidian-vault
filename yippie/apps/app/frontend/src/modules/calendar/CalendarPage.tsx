import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, ChevronLeft, ChevronRight, Edit2, ExternalLink, Plus, Settings2, Trash2, User, X } from 'lucide-react'
import { useContextMenu, ContextMenu } from '../../components/ContextMenu'
import { api } from '../../api/client'
import { useTenantConfig } from '../../App'
import SendBookingModal from '../booking/SendBookingModal'
import ContactPeekModal from '../../components/ContactPeekModal'
import TicketPeekModal from '../../components/TicketPeekModal'

interface CalendarItem {
  kind: 'event' | 'deadline'
  id: string
  title: string
  start_at: string
  end_at: string | null
  all_day: boolean
  description: string | null
  contact_id: string | null
  contact_name: string | null
  ticket_id: string | null
  ticket_subject: string | null
  ticket_status: string | null
  ticket_priority: string | null
  calendar_type: string | null
  created_by: string | null
}

interface EventPayload {
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  contact_id: string | null
  ticket_id: string | null
  calendar_type: string
}

type CalendarTypeFilter = 'all' | 'shared' | 'personal'

interface PickerOption { id: string; label: string }

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toDateInput = (d: Date) => dateKey(d)
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

function errDetail(e: unknown) {
  const d = (e as any)?.response?.data?.detail
  return typeof d === 'string' ? d : 'Something went wrong.'
}

/** Monday-start grid: 6 full weeks covering the given month. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // days since Monday
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

/** Red when overdue or due within a day; orange otherwise (mirrors the Sidebar badges). */
function deadlineColor(startAt: string): 'red' | 'orange' {
  const due = new Date(startAt).getTime()
  return due <= Date.now() + 24 * 60 * 60 * 1000 ? 'red' : 'orange'
}

// ---------------------------------------------------------------------------
// Typeahead picker (contacts / tickets)
// ---------------------------------------------------------------------------

function Picker({ label, placeholder, selected, onSelect, options, loading, onQueryChange }: {
  label: string
  placeholder: string
  selected: PickerOption | null
  onSelect: (opt: PickerOption | null) => void
  options: PickerOption[]
  loading?: boolean
  onQueryChange: (q: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)

  return (
    <div className="relative">
      <label className={labelCls}>{label}</label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50">
          <span className="text-slate-800 truncate">{selected.label}</span>
          <button type="button" onClick={() => { onSelect(null); setQuery(''); onQueryChange('') }}
            className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <input
          className={inputCls}
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); onQueryChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150) }}
        />
      )}
      {open && !selected && query.trim().length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-44 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-slate-400">Searching…</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
          ) : options.map(opt => (
            <button key={opt.id} type="button"
              onMouseDown={() => { window.clearTimeout(blurTimer.current); onSelect(opt); setOpen(false) }}
              className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 truncate">
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContactPicker({ selected, onSelect }: {
  selected: PickerOption | null
  onSelect: (opt: PickerOption | null) => void
}) {
  const [q, setQ] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['calendar-contact-search', q],
    queryFn: () => api.get<{ items: { id: string; full_name: string; email: string | null }[] }>(
      '/contacts', { params: { search: q, limit: 10 } }).then((r: any) => r.data.items),
    enabled: q.trim().length > 0,
  })
  const options = (data ?? []).map((c: any) => ({ id: c.id, label: c.email ? `${c.full_name} — ${c.email}` : c.full_name }))
  return <Picker label="Contact (optional)" placeholder="Search contacts…"
    selected={selected} onSelect={onSelect} options={options} loading={isFetching} onQueryChange={setQ} />
}

function TicketPicker({ selected, onSelect }: {
  selected: PickerOption | null
  onSelect: (opt: PickerOption | null) => void
}) {
  const [q, setQ] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['calendar-ticket-options'],
    queryFn: () => api.get<{ items: { id: string; subject: string }[] }>(
      '/tickets', { params: { limit: 100 } }).then((r: any) => r.data.items),
  })
  const term = q.trim().toLowerCase()
  const options = (data ?? [])
    .filter((t: any) => t.subject.toLowerCase().includes(term))
    .slice(0, 10)
    .map((t: any) => ({ id: t.id, label: t.subject }))
  return <Picker label="Ticket (optional)" placeholder="Search tickets…"
    selected={selected} onSelect={onSelect} options={options} loading={isFetching} onQueryChange={setQ} />
}

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

function EventModal({ event, onClose, onSaved, defaultDate }: {
  event: CalendarItem | null   // null = create
  onClose: () => void
  onSaved: () => void
  defaultDate?: Date
}) {
  const start = event ? new Date(event.start_at) : null
  const end = event?.end_at ? new Date(event.end_at) : null

  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(start ? toDateInput(start) : defaultDate ? toDateInput(defaultDate) : toDateInput(new Date()))
  const [time, setTime] = useState(start && !event?.all_day ? toTimeInput(start) : defaultDate ? '12:00' : '09:00')
  const [endDate, setEndDate] = useState(end ? toDateInput(end) : '')
  const [endTime, setEndTime] = useState(end && !event?.all_day ? toTimeInput(end) : '')
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [description, setDescription] = useState(event?.description ?? '')
  const [calendarType, setCalendarType] = useState<'shared' | 'personal'>(
    (event?.calendar_type as 'shared' | 'personal') ?? 'shared')
  const [contact, setContact] = useState<PickerOption | null>(
    event?.contact_id ? { id: event.contact_id, label: event.contact_name ?? 'Linked contact' } : null)
  const [ticket, setTicket] = useState<PickerOption | null>(
    event?.ticket_id ? { id: event.ticket_id, label: event.ticket_subject ?? 'Linked ticket' } : null)
  const [error, setError] = useState('')

  const saveMutation = useMutation({
    mutationFn: (payload: EventPayload) =>
      event ? api.patch(`/calendar/events/${event.id}`, payload) : api.post('/calendar/events', payload),
    onSuccess: () => { onSaved(); onClose() },
    onError: (e: any) => setError(errDetail(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/calendar/events/${event!.id}`),
    onSuccess: () => { onSaved(); onClose() },
    onError: (e: any) => setError(errDetail(e)),
  })

  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!title.trim()) { setError('Title is required'); return }
    if (!date) { setError('Date is required'); return }
    if (!allDay && !time) { setError('Time is required'); return }

    const startAt = new Date(`${date}T${allDay ? '00:00' : time}`)
    let endAt: Date | null = null
    if (endDate) {
      endAt = new Date(`${endDate}T${allDay ? '23:59' : (endTime || time)}`)
      if (endAt < startAt) { setError('End must be after start'); return }
    }
    setError('')
    saveMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      start_at: startAt.toISOString(),
      end_at: endAt ? endAt.toISOString() : null,
      all_day: allDay,
      contact_id: contact?.id ?? null,
      ticket_id: ticket?.id ?? null,
      calendar_type: calendarType,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">{event ? 'Edit event' : 'New event'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Call with customer…" maxLength={255} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Time {allDay ? '' : '*'}</label>
              <input type="time" className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                value={time} onChange={e => setTime(e.target.value)} disabled={allDay} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>End date</label>
              <input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>End time</label>
              <input type="time" className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                value={endTime} onChange={e => setEndTime(e.target.value)} disabled={allDay || !endDate} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
            <span className="text-sm text-slate-700 font-medium">All day</span>
          </label>

          <div>
            <label className={labelCls}>Visibility</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCalendarType('shared')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${calendarType === 'shared' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                Shared (team)
              </button>
              <button type="button" onClick={() => setCalendarType('personal')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${calendarType === 'personal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                Personal (only me)
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`}
              value={description} onChange={e => setDescription(e.target.value)} placeholder="Any context…" />
          </div>

          <ContactPicker selected={contact} onSelect={setContact} />
          <TicketPicker selected={ticket} onSelect={setTicket} />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saveMutation.isPending}
              className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity">
              {saveMutation.isPending ? 'Saving…' : event ? 'Save changes' : 'Create event'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            {event && (
              <button type="button" disabled={deleteMutation.isPending}
                onClick={() => { if (confirm(`Delete "${event.title}"?`)) deleteMutation.mutate() }}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bookings (BK1)
// ---------------------------------------------------------------------------

interface BookingToken {
  id: string
  contact_id: string
  contact_name: string | null
  created_by_name: string | null
  mode: string
  expires_at: string
  booked_at: string | null
  customer_proposed_slots: Array<{ start: string; end: string }> | null
  status: 'pending' | 'booked' | 'expired' | 'counter_proposed'
}

interface WeeklySlotEntry {
  time: string    // HH:MM
  capacity: number
}

interface CalendarSettings {
  work_start_hour: number
  work_end_hour: number
  slot_minutes: number
  booking_expiry_days: number
  booking_window_days: number
  post_booking_stage_id: string | null
  use_weekly_slots: boolean
  weekly_slots: Record<string, WeeklySlotEntry[]> | null
  cancel_edit_hours_before: number
  timezone: string
}

type BookingTab = 'pending' | 'counter_proposed' | 'booked' | 'expired'

function fmtSlotShort(start: string, end: string) {
  const s = new Date(start)
  const day = s.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const t1 = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  const t2 = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day}, ${t1}–${t2}`
}

function BookingsPanel({ onClose, onNewBooking, onOpenSettings }: { onClose: () => void; onNewBooking: () => void; onOpenSettings: () => void }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<BookingTab>('pending')

  const { data: tokens = [] } = useQuery<BookingToken[]>({
    queryKey: ['booking-tokens'],
    queryFn: () => api.get('/booking/tokens').then((r: any) => r.data),
  })

  const revokeMut = useMutation({
    mutationFn: (id: string) => api.delete(`/booking/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-tokens'] }),
  })

  const acceptMut = useMutation({
    mutationFn: ({ tokenId, slot }: { tokenId: string; slot: { start: string; end: string } }) =>
      api.post(`/public/booking/${tokenId}/confirm`, { slot_start: slot.start, slot_end: slot.end }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booking-tokens'] }),
  })

  // Show counter_proposed tab only when there are items (otherwise don't clutter the tab bar)
  const counterCount = tokens.filter((x: any) => x.status === 'counter_proposed').length
  const tabs: BookingTab[] = counterCount > 0
    ? ['pending', 'counter_proposed', 'booked', 'expired']
    : ['pending', 'booked', 'expired']

  const filtered = tokens.filter((t: any) => t.status === tab)

  const tabLabel = (t: BookingTab) => {
    if (t === 'counter_proposed') return 'Waiting'
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Booking links</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onClose(); onNewBooking() }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yippie hover:opacity-90 text-white text-xs font-semibold rounded-lg transition-opacity"
            >
              <Plus size={13} strokeWidth={2.5} /> New booking
            </button>
            <button onClick={onOpenSettings} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="Booking settings">
              <Settings2 size={15} />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        <div className="flex gap-1 px-4 py-3 border-b border-slate-100 shrink-0 flex-wrap">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === t
                  ? t === 'counter_proposed' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {tabLabel(t)} ({tokens.filter((x: any) => x.status === t).length})
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">No {tabLabel(tab).toLowerCase()} booking links.</p>
          )}
          {filtered.map((t: any) => (
            <div key={t.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {t.contact_name ?? 'Unknown contact'}
                    </p>
                    {t.status === 'counter_proposed' && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 shrink-0">
                        Waiting
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Sent by {t.created_by_name ?? '—'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.status === 'booked' && t.booked_at
                      ? `Booked ${new Date(t.booked_at).toLocaleString()}`
                      : `Expires ${new Date(t.expires_at).toLocaleString()}`}
                  </p>
                </div>
                {t.status === 'pending' && (
                  <button
                    onClick={() => { if (confirm('Revoke this booking link?')) revokeMut.mutate(t.id) }}
                    className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-600"
                  >
                    Revoke
                  </button>
                )}
              </div>

              {/* Counter-proposed slots — agent can accept one */}
              {t.status === 'counter_proposed' && t.customer_proposed_slots && t.customer_proposed_slots.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Customer proposed:</p>
                  {t.customer_proposed_slots.map((slot: any, idx: any) => (
                    <button
                      key={idx}
                      disabled={acceptMut.isPending}
                      onClick={() => {
                        if (confirm(`Accept: ${fmtSlotShort(slot.start, slot.end)}?`)) {
                          acceptMut.mutate({ tokenId: t.id, slot })
                        }
                      }}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors text-left disabled:opacity-50"
                    >
                      <span className="text-xs font-semibold text-amber-800">{fmtSlotShort(slot.start, slot.end)}</span>
                      <span className="text-[10px] font-bold text-amber-700 shrink-0">Accept</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function WeeklyGrid({
  slots,
  onChange,
}: {
  slots: Record<string, WeeklySlotEntry[]>
  onChange: (slots: Record<string, WeeklySlotEntry[]>) => void
}) {
  // Per-day inline-add state: {dayKey -> {time, capacity}}
  const [adding, setAdding] = useState<Record<string, { time: string; capacity: number }>>({})

  function startAdd(dayKey: string) {
    setAdding(prev => ({ ...prev, [dayKey]: { time: '09:00', capacity: 1 } }))
  }

  function cancelAdd(dayKey: string) {
    setAdding(prev => { const n = { ...prev }; delete n[dayKey]; return n })
  }

  function commitAdd(dayKey: string) {
    const entry = adding[dayKey]
    if (!entry) return
    // Validate HH:MM
    if (!/^\d{2}:\d{2}$/.test(entry.time)) return
    const existing = slots[dayKey] ?? []
    // Prevent duplicate times on same day
    if (existing.some(e => e.time === entry.time)) {
      cancelAdd(dayKey)
      return
    }
    const updated = { ...slots, [dayKey]: [...existing, entry].sort((a, b) => a.time.localeCompare(b.time)) }
    onChange(updated)
    cancelAdd(dayKey)
  }

  function removeSlot(dayKey: string, idx: number) {
    const updated = { ...slots, [dayKey]: (slots[dayKey] ?? []).filter((_, i) => i !== idx) }
    onChange(updated)
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
      {DAY_LABELS.map((label, i) => {
        const dayKey = String(i)
        const daySlots = slots[dayKey] ?? []
        const addState = adding[dayKey]
        return (
          <div key={dayKey} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 w-24 shrink-0">{label}</span>
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {daySlots.length === 0 && !addState && (
                  <span className="text-xs text-slate-400 italic">No slots</span>
                )}
                {daySlots.map((entry, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100"
                  >
                    {entry.time} ×{entry.capacity}
                    <button
                      onClick={() => removeSlot(dayKey, idx)}
                      className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors leading-none"
                      title="Remove slot"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {!addState && (
                <button
                  onClick={() => startAdd(dayKey)}
                  className="shrink-0 ml-2 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg px-2 py-0.5 transition-colors"
                >
                  + Add
                </button>
              )}
            </div>
            {addState && (
              <div className="flex items-center gap-2 mt-1.5 pl-24">
                <input
                  type="time"
                  value={addState.time}
                  onChange={e => setAdding(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], time: e.target.value } }))}
                  className="px-2 py-1 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-28"
                />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={addState.capacity}
                  onChange={e => setAdding(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], capacity: Math.max(1, Number(e.target.value)) } }))}
                  className="px-2 py-1 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-16"
                  title="Max bookings for this slot"
                />
                <span className="text-xs text-slate-400">cap</span>
                <button
                  onClick={() => commitAdd(dayKey)}
                  className="px-3 py-1 bg-yippie text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
                >
                  Add
                </button>
                <button
                  onClick={() => cancelAdd(dayKey)}
                  className="px-2 py-1 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BookingSettingsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: settings } = useQuery<CalendarSettings>({
    queryKey: ['booking-settings'],
    queryFn: () => api.get('/booking/settings').then((r: any) => r.data),
  })
  const { data: stages = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
  })

  const [form, setForm] = useState<CalendarSettings | null>(null)
  const current = form ?? settings ?? null

  const saveMut = useMutation({
    mutationFn: (body: Partial<CalendarSettings>) => api.patch('/booking/settings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booking-settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  function update(patch: Partial<CalendarSettings>) {
    setForm({ ...(current as CalendarSettings), ...patch })
  }

  const hourOptions = Array.from({ length: 25 }, (_, i) => i)

  const weeklySlots: Record<string, WeeklySlotEntry[]> = (current?.weekly_slots as Record<string, WeeklySlotEntry[]>) ?? {}

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings2 size={16} className="text-slate-400" /> Booking settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {current ? (
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            {/* Weekly schedule toggle */}
            <div className="flex items-center justify-between py-2 border border-slate-200 rounded-xl px-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Use weekly schedule</p>
                <p className="text-xs text-slate-400 mt-0.5">Define specific time slots per day instead of uniform work hours</p>
              </div>
              <button
                onClick={() => update({ use_weekly_slots: !current.use_weekly_slots })}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  current.use_weekly_slots ? 'bg-blue-600' : 'bg-slate-200'
                }`}
                role="switch"
                aria-checked={current.use_weekly_slots}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  current.use_weekly_slots ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {current.use_weekly_slots ? (
              /* Weekly grid */
              <div>
                <label className={labelCls}>Weekly schedule</label>
                <p className="text-xs text-slate-400 mb-2">Click "+ Add" on any day to add a time slot and set the max bookings (capacity) for that slot.</p>
                <WeeklyGrid
                  slots={weeklySlots}
                  onChange={newSlots => update({ weekly_slots: newSlots })}
                />
              </div>
            ) : (
              /* Legacy work-hours inputs */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Work start hour</label>
                    <select className={inputCls} value={current.work_start_hour}
                      onChange={e => update({ work_start_hour: Number(e.target.value) })}>
                      {hourOptions.slice(0, 24).map(h => <option key={h} value={h}>{pad(h)}:00</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Work end hour</label>
                    <select className={inputCls} value={current.work_end_hour}
                      onChange={e => update({ work_end_hour: Number(e.target.value) })}>
                      {hourOptions.slice(1).map(h => <option key={h} value={h}>{pad(h)}:00</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Slot size</label>
                    <select className={inputCls} value={current.slot_minutes}
                      onChange={e => update({ slot_minutes: Number(e.target.value) })}>
                      {[15, 30, 60].map(m => <option key={m} value={m}>{m} min</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Link expiry</label>
                    <select className={inputCls} value={current.booking_expiry_days}
                      onChange={e => update({ booking_expiry_days: Number(e.target.value) })}>
                      {[1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d} day{d !== 1 ? 's' : ''}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Link expiry always visible in weekly mode too */}
            {current.use_weekly_slots && (
              <div>
                <label className={labelCls}>Link expiry</label>
                <select className={inputCls} value={current.booking_expiry_days}
                  onChange={e => update({ booking_expiry_days: Number(e.target.value) })}>
                  {[1, 2, 3, 5, 7].map(d => <option key={d} value={d}>{d} day{d !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Move to stage after booking</label>
              <select className={inputCls} value={current.post_booking_stage_id ?? ''}
                onChange={e => update({ post_booking_stage_id: e.target.value || null })}>
                <option value="">— None —</option>
                {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Lock changes X hours before appointment</label>
              <input
                type="number"
                min={1}
                max={720}
                className={inputCls}
                value={current.cancel_edit_hours_before ?? 24}
                onChange={e => update({ cancel_edit_hours_before: Math.max(1, Math.min(720, Number(e.target.value))) })}
              />
              <p className="mt-1 text-xs text-slate-400">
                Customers cannot reschedule or cancel within this many hours of their appointment.
              </p>
            </div>
            <div>
              <label className={labelCls}>How far ahead customers can book</label>
              <select className={inputCls} value={current.booking_window_days ?? 60}
                onChange={e => update({ booking_window_days: Number(e.target.value) })}>
                {[14, 30, 60, 90, 120, 180].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                The booking and meeting pages offer open slots up to this many days into the future.
              </p>
            </div>
            <div>
              <label className={labelCls}>Timezone</label>
              <select className={inputCls} value={current.timezone ?? 'Europe/Amsterdam'}
                onChange={e => update({ timezone: e.target.value })}>
                <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
                <option value="Africa/Johannesburg">Africa/Johannesburg (SAST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="UTC">UTC</option>
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Work hours above are interpreted in this timezone.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => saveMut.mutate({
                  work_start_hour: current.work_start_hour,
                  work_end_hour: current.work_end_hour,
                  slot_minutes: current.slot_minutes,
                  booking_expiry_days: current.booking_expiry_days,
                  booking_window_days: current.booking_window_days,
                  post_booking_stage_id: current.post_booking_stage_id,
                  use_weekly_slots: current.use_weekly_slots,
                  weekly_slots: current.weekly_slots,
                  cancel_edit_hours_before: current.cancel_edit_hours_before,
                  timezone: current.timezone,
                })}
                disabled={saveMut.isPending}
                className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
              >
                {saveMut.isPending ? 'Saving…' : 'Save settings'}
              </button>
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
            </div>
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Loading…</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar page
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const navigate = useNavigate()
  const ctx = useContextMenu()
  const qc = useQueryClient()
  const config = useTenantConfig()
  const bookingEnabled = config?.enabled_modules?.includes('booking') ?? false
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [peekContactId, setPeekContactId] = useState<string | null>(null)
  const [peekTicketId, setPeekTicketId] = useState<string | null>(null)
  const [month, setMonth] = useState(today.getMonth()) // 0-based
  const [modal, setModal] = useState<{ open: boolean; event: CalendarItem | null; defaultDate?: Date }>({ open: false, event: null })

  const deleteEventMut = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-items'] }),
  })
  const [calendarTypeFilter, setCalendarTypeFilter] = useState<CalendarTypeFilter>('all')
  const [bookingsOpen, setBookingsOpen] = useState(false)
  const [newBookingOpen, setNewBookingOpen] = useState(false)
  const [bookingSettingsOpen, setBookingSettingsOpen] = useState(false)

  const { data: bookingTokens } = useQuery<BookingToken[]>({
    queryKey: ['booking-tokens'],
    queryFn: () => api.get('/booking/tokens').then((r: any) => r.data),
    enabled: bookingEnabled,
  })
  const pendingCount = (bookingTokens ?? []).filter((t: any) => t.status === 'pending' || t.status === 'counter_proposed').length

  const days = useMemo(() => monthGrid(year, month), [year, month])
  const rangeStart = days[0]
  const rangeEnd = new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate() + 1)

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-items', dateKey(rangeStart), dateKey(rangeEnd), calendarTypeFilter],
    queryFn: () => api.get<{ items: CalendarItem[] }>('/calendar/items', {
      params: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
        ...(calendarTypeFilter !== 'all' ? { calendar_type: calendarTypeFilter } : {}),
      },
    }).then((r: any) => r.data.items),
  })

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const item of data ?? []) {
      const key = dateKey(new Date(item.start_at))
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return map
  }, [data])

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear()); setMonth(d.getMonth())
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(today)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Calendar</h1>
        <div className="flex items-center gap-2">
          {bookingEnabled && (
            <>
              <button onClick={() => setBookingsOpen(true)}
                className="relative inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
                <CalendarClock size={15} strokeWidth={2.5} /> Bookings
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-blue-600 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button onClick={() => setNewBookingOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
                <Plus size={15} strokeWidth={2.5} /> New booking
              </button>
              <button onClick={() => setBookingSettingsOpen(true)}
                className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg transition-colors"
                title="Booking settings">
                <Settings2 size={15} />
              </button>
            </>
          )}
          <button onClick={() => setModal({ open: true, event: null })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">
            <Plus size={15} strokeWidth={2.5} /> New event
          </button>
        </div>
      </div>

      {/* Calendar type filter */}
      <div className="flex items-center gap-1 mb-4">
        {(['all', 'shared', 'personal'] as CalendarTypeFilter[]).map(t => (
          <button
            key={t}
            onClick={() => setCalendarTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors capitalize ${
              calendarTypeFilter === t
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t === 'all' ? 'All events' : t === 'shared' ? 'Shared' : 'Personal'}
          </button>
        ))}
      </div>

      {bookingEnabled && bookingsOpen && (
        <BookingsPanel
          onClose={() => setBookingsOpen(false)}
          onNewBooking={() => setNewBookingOpen(true)}
          onOpenSettings={() => setBookingSettingsOpen(true)}
        />
      )}

      {/* Month card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-slate-800">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftMonth(-1)} aria-label="Previous month"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Today
            </button>
            <button onClick={() => shiftMonth(1)} aria-label="Next month"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAYS.map(d => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const key = dateKey(day)
            const inMonth = day.getMonth() === month
            const isToday = key === todayKey
            const items = itemsByDay.get(key) ?? []
            return (
              <div key={key}
                className={`min-h-[96px] p-1.5 border-gray-100 ${i % 7 !== 0 ? 'border-l' : ''} ${i >= 7 ? 'border-t' : ''} ${inMonth ? 'bg-white' : 'bg-slate-50/60'}`}
                onContextMenu={e => { e.preventDefault(); const noon = new Date(day); noon.setHours(12, 0, 0, 0); ctx.open(e, [{ label: 'New event on this date', icon: <Plus size={13} />, onClick: () => setModal({ open: true, event: null, defaultDate: noon }) }]) }}>
                <div className="flex justify-end mb-1">
                  <span className={`w-6 h-6 flex items-center justify-center text-xs rounded-full ${
                    isToday ? 'bg-yippie text-white font-bold'
                      : inMonth ? 'text-slate-600 font-medium' : 'text-slate-300 font-medium'
                  }`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {items.map(item => {
                    if (item.kind === 'deadline') {
                      const color = deadlineColor(item.start_at)
                      return (
                        <button key={`d-${item.id}`} onClick={() => navigate(`/tickets/${item.ticket_id}`)}
                          title={`Deadline — ${item.title}`}
                          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); ctx.open(e, [
                            { label: 'View ticket', icon: <ExternalLink size={13} />, onClick: () => setPeekTicketId(item.ticket_id) },
                          ]) }}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate border transition-colors ${
                            color === 'red'
                              ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                              : 'bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100'
                          }`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${color === 'red' ? 'bg-red-500' : 'bg-orange-400'}`} />
                          {item.title}
                        </button>
                      )
                    }
                    return (
                      <button key={`e-${item.id}`} onClick={() => setModal({ open: true, event: item })}
                        title={item.title}
                        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); ctx.open(e, [
                          { label: 'Edit event', icon: <Edit2 size={13} />, onClick: () => setModal({ open: true, event: item }) },
                          ...(item.contact_id ? [{ label: 'View contact', icon: <User size={13} />, onClick: () => setPeekContactId(item.contact_id) }] : []),
                          ...(item.ticket_id ? [{ label: 'View ticket', icon: <ExternalLink size={13} />, onClick: () => setPeekTicketId(item.ticket_id) }] : []),
                          { separator: true },
                          { label: 'Delete event', icon: <Trash2 size={13} />, danger: true, onClick: () => { if (confirm(`Delete "${item.title}"?`)) deleteEventMut.mutate(item.id) } },
                        ]) }}
                        className="w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors">
                        {!item.all_day && (
                          <span className="font-semibold mr-1">
                            {new Date(item.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        )}
                        {item.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {isLoading && <div className="px-6 py-3 text-sm text-slate-400 border-t border-gray-100">Loading…</div>}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-4 px-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Event
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Ticket deadline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Due within 24h / overdue
        </span>
      </div>

      {modal.open && (
        <EventModal
          event={modal.event}
          defaultDate={modal.defaultDate}
          onClose={() => setModal({ open: false, event: null })}
          onSaved={() => qc.invalidateQueries({ queryKey: ['calendar-items'] })}
        />
      )}
      <ContextMenu state={ctx.state} onClose={ctx.close} />
      <ContactPeekModal contactId={peekContactId} onClose={() => setPeekContactId(null)} />
      <TicketPeekModal ticketId={peekTicketId} onClose={() => setPeekTicketId(null)} />

      {bookingEnabled && (
        <SendBookingModal
          open={newBookingOpen}
          onClose={() => setNewBookingOpen(false)}
        />
      )}

      {bookingEnabled && bookingSettingsOpen && (
        <BookingSettingsModal onClose={() => setBookingSettingsOpen(false)} />
      )}
    </div>
  )
}
