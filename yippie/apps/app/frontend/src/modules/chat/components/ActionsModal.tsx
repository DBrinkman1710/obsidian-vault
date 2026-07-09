import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'

// ---- Shared helpers (booking calendar) ----
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function fmtSlot(start: Date, end: Date) {
  const day = start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  const t = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${t(start)}–${t(end)}`
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - offset)
  return Array.from({ length: 42 }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

// ---- Priority styles (ticket pane) ----
const PRIORITY_STYLES: Record<string, { active: string; inactive: string }> = {
  low:    { active: 'bg-slate-500 text-white border-slate-500',   inactive: 'border-slate-300 text-slate-500 hover:bg-slate-50' },
  medium: { active: 'bg-blue-600 text-white border-blue-600',     inactive: 'border-blue-300 text-blue-600 hover:bg-blue-50' },
  high:   { active: 'bg-amber-500 text-white border-amber-500',   inactive: 'border-amber-300 text-amber-600 hover:bg-amber-50' },
  urgent: { active: 'bg-red-600 text-white border-red-600',       inactive: 'border-red-300 text-red-600 hover:bg-red-50' },
}

// ---- Contact picker (ticket pane) ----
interface ContactRow {
  id: string
  full_name: string
  email: string | null
  company: { id: string; name: string } | null
}

function ContactPicker({ value, onChange }: {
  value: { id: string; label: string } | null
  onChange: (c: { id: string; label: string } | null) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['contacts-picker', search],
    queryFn: () => api.get<{ items: ContactRow[] }>('/contacts', { params: { search: search || undefined, limit: 8 } })
      .then((r: any) => r.data.items),
    enabled: open,
  })

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">{value.label}</span>
        <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search contacts by name, email or company…"
      />
      {open && (
        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {!data?.length ? (
            <div className="px-4 py-3 text-sm text-slate-400">{search ? 'No contacts found' : 'Start typing to search…'}</div>
          ) : data.map((c: any) => (
            <button key={c.id} type="button"
              onMouseDown={() => {
                onChange({ id: c.id, label: c.company ? `${c.full_name} (${c.company.name})` : c.full_name })
                setOpen(false); setSearch('')
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
              <span className="font-medium text-slate-900">{c.full_name}</span>
              {c.company && <span className="text-slate-500 ml-2">{c.company.name}</span>}
              {c.email && <span className="text-slate-400 ml-2 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Props ----
interface Session {
  id: string
  contact_id?: string | null
  visitor_name?: string | null
  whatsapp_phone?: string | null
}

interface Props {
  session: Session
  defaultPane?: 'ticket' | 'booking'
  onClose: () => void
  onTicketLinked: () => void
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

export default function ActionsModal({ session, defaultPane = 'ticket', onClose, onTicketLinked }: Props) {
  const qc = useQueryClient()
  const [pane, setPane] = useState<'ticket' | 'booking'>(defaultPane)

  // ---- Ticket form state ----
  const [subject, setSubject] = useState(session.visitor_name || session.whatsapp_phone || '')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [contact, setContact] = useState<{ id: string; label: string } | null>(
    session.contact_id
      ? { id: session.contact_id, label: session.visitor_name || 'Contact' }
      : null
  )
  const [departmentId, setDepartmentId] = useState('')
  const [ticketError, setTicketError] = useState('')

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r: any) => r.data),
  })

  const ticketMutation = useMutation({
    mutationFn: async () => {
      const ticket = await api.post('/tickets', {
        subject: subject.trim(),
        description: description.trim() || null,
        priority,
        contact_id: contact?.id ?? null,
        department_id: departmentId || null,
        source: 'chat',
      }).then((r: any) => r.data)
      await api.patch(`/chat/sessions/${session.id}`, { ticket_id: ticket.id })
      return ticket
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-sessions'] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket created')
      onTicketLinked()
      onClose()
    },
    onError: (e: any) => setTicketError(e?.response?.data?.detail ?? e?.message ?? 'Failed to create ticket'),
  })

  function handleCreateTicket() {
    if (!subject.trim()) { setTicketError('Subject is required'); return }
    setTicketError('')
    ticketMutation.mutate()
  }

  // ---- Booking form state ----
  const today = new Date()
  const [mode, setMode] = useState<'open' | 'propose'>('open')
  const [bookingMessage, setBookingMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([])

  const [bookingContact, setBookingContact] = useState<{ id: string; full_name: string; email?: string | null } | null>(
    session.contact_id ? { id: session.contact_id, full_name: session.visitor_name || '' } : null
  )
  const [bookingQuery, setBookingQuery] = useState('')
  const [bookingDropOpen, setBookingDropOpen] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)

  // Email prompt — shown when contact has no email before sending booking
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)
  const [promptEmail, setPromptEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const { data: bookingSettings } = useQuery<{
    work_start_hour: number; work_end_hour: number; slot_minutes: number
  }>({
    queryKey: ['booking-settings'],
    queryFn: () => api.get('/booking/settings').then((r: any) => r.data),
    enabled: pane === 'booking',
  })

  const { data: bookingResults } = useQuery<{ id: string; full_name: string; email?: string | null }[]>({
    queryKey: ['booking-contact-search', bookingQuery],
    queryFn: () => api.get('/contacts', { params: { search: bookingQuery, limit: 10 } })
      .then((r: any) => r.data.items.map((c: any) => ({ id: c.id, full_name: c.full_name, email: c.email }))),
    enabled: pane === 'booking' && !bookingContact && bookingQuery.trim().length > 0,
  })

  const days = useMemo(() => monthGrid(year, month), [year, month])
  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(today)

  const dayChips = useMemo(() => {
    if (!activeDay || !bookingSettings) return []
    const [y, m, d] = activeDay.split('-').map(Number)
    const step = bookingSettings.slot_minutes
    const out: { start: string; end: string }[] = []
    let cursor = new Date(y, m - 1, d, bookingSettings.work_start_hour, 0, 0)
    const end = new Date(y, m - 1, d, bookingSettings.work_end_hour, 0, 0)
    while (cursor.getTime() + step * 60000 <= end.getTime()) {
      const slotEnd = new Date(cursor.getTime() + step * 60000)
      out.push({ start: new Date(cursor).toISOString(), end: slotEnd.toISOString() })
      cursor = slotEnd
    }
    return out
  }, [activeDay, bookingSettings])

  function shiftMonth(delta: number) {
    const dt = new Date(year, month + delta, 1)
    setYear(dt.getFullYear()); setMonth(dt.getMonth())
  }

  function toggleSlot(slot: { start: string; end: string }) {
    setSlots(prev =>
      prev.some(s => s.start === slot.start)
        ? prev.filter(s => s.start !== slot.start)
        : [...prev, slot])
  }

  async function dispatchBooking() {
    if (!bookingContact) return
    setSending(true)
    try {
      await api.post('/booking/send', {
        contact_id: bookingContact.id,
        mode,
        message: bookingMessage.trim() || undefined,
        proposed_slots: mode === 'propose' ? slots : undefined,
      })
      toast.success('Booking link sent!')
      onClose()
    } catch {
      toast.error('Could not send booking link.')
    } finally {
      setSending(false)
    }
  }

  async function handleSendBooking() {
    if (!bookingContact) { toast.error('Select a contact first.'); return }
    if (mode === 'propose' && slots.length === 0) { toast.error('Add at least one proposed time.'); return }
    // If contact has no email, prompt the agent to add one before sending
    if (!bookingContact.email) {
      setPromptEmail('')
      setShowEmailPrompt(true)
      return
    }
    await dispatchBooking()
  }

  async function handleEmailPromptConfirm() {
    if (!bookingContact || !promptEmail.trim()) return
    setSavingEmail(true)
    try {
      await api.patch(`/contacts/${bookingContact.id}`, { email: promptEmail.trim() })
      setBookingContact({ ...bookingContact, email: promptEmail.trim() })
      setShowEmailPrompt(false)
      await dispatchBooking()
    } catch {
      toast.error('Could not save email address.')
    } finally {
      setSavingEmail(false)
    }
  }

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${active
      ? 'bg-blue-600 text-white'
      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex gap-2">
            <button onClick={() => setPane('ticket')} className={tabCls(pane === 'ticket')}>Create Ticket</button>
            <button onClick={() => setPane('booking')} className={tabCls(pane === 'booking')}>Send Booking</button>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* ---- Ticket pane ---- */}
          {pane === 'ticket' && (
            <>
              <div>
                <label className={labelCls}>Subject *</label>
                <input
                  className={`${inputCls} ${ticketError ? 'border-red-400' : ''}`}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Short description of the issue"
                  autoFocus
                />
                {ticketError && <p className="text-xs text-red-500 mt-1">{ticketError}</p>}
              </div>

              <div>
                <label className={labelCls}>Contact <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                <ContactPicker value={contact} onChange={setContact} />
              </div>

              <div>
                <label className={labelCls}>Priority</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className={`px-4 py-1.5 rounded-full border text-xs font-semibold capitalize transition-colors ${priority === p ? PRIORITY_STYLES[p].active : PRIORITY_STYLES[p].inactive}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Department <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                <select className={inputCls} value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                  <option value="">No department</option>
                  {departments?.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.sla_working_days}d SLA)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  className={`${inputCls} resize-vertical min-h-[100px] font-[inherit]`}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What happened? Any relevant details…"
                />
              </div>
            </>
          )}

          {/* ---- Booking pane ---- */}
          {pane === 'booking' && (
            <>
              {/* Contact */}
              <div>
                <label className={labelCls}>Contact *</label>
                {bookingContact ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50">
                    <span className="text-slate-800 truncate">{bookingContact.full_name}</span>
                    {!session.contact_id && (
                      <button type="button" onClick={() => { setBookingContact(null); setBookingQuery('') }}
                        className="text-slate-400 hover:text-slate-600 shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      className={inputCls}
                      placeholder="Search contacts…"
                      value={bookingQuery}
                      onChange={e => { setBookingQuery(e.target.value); setBookingDropOpen(true) }}
                      onFocus={() => setBookingDropOpen(true)}
                      onBlur={() => { blurTimer.current = window.setTimeout(() => setBookingDropOpen(false), 150) }}
                      autoFocus={pane === 'booking'}
                    />
                    {bookingDropOpen && bookingQuery.trim().length > 0 && (
                      <div className="absolute z-20 mt-1 w-full max-h-44 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
                        {(bookingResults ?? []).length === 0 ? (
                          <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
                        ) : (bookingResults ?? []).map((c: any) => (
                          <button key={c.id} type="button"
                            onMouseDown={() => {
                              window.clearTimeout(blurTimer.current)
                              setBookingContact(c)
                              setBookingDropOpen(false)
                            }}
                            className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 truncate">
                            {c.full_name}{c.email ? ` (${c.email})` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2">
                <button onClick={() => setMode('open')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${mode === 'open' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  Customer picks time
                </button>
                <button onClick={() => setMode('propose')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${mode === 'propose' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  Propose times
                </button>
              </div>

              {/* Calendar — only when propose mode */}
              {mode === 'propose' && (
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
                        <button key={key} disabled={isPast} onClick={() => setActiveDay(key)}
                          className={`h-8 text-xs rounded-lg transition-colors ${
                            isActive ? 'bg-blue-600 text-white font-bold'
                              : isPast ? 'text-slate-300 cursor-not-allowed'
                              : inMonth ? 'text-slate-700 hover:bg-slate-100'
                              : 'text-slate-300 hover:bg-slate-50'
                          }`}>
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
                            <button key={chip.start} onClick={() => toggleSlot(chip)}
                              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                                selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}>
                              {new Date(chip.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </button>
                          )
                        })}
                        {dayChips.length === 0 && <p className="text-xs text-slate-400">No slots for this day.</p>}
                      </div>
                    </div>
                  )}

                  {slots.length > 0 && (
                    <div className="px-3 py-3 border-t border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">Proposed ({slots.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {slots.slice().sort((a, b) => a.start.localeCompare(b.start)).map(s => (
                          <span key={s.start} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md">
                            {fmtSlot(new Date(s.start), new Date(s.end))}
                            <button onClick={() => toggleSlot(s)} className="hover:text-blue-900"><X size={11} /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Message */}
              <div>
                <label className={labelCls}>Message <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                <textarea
                  value={bookingMessage}
                  onChange={e => setBookingMessage(e.target.value)}
                  placeholder="Add a short note for the customer…"
                  className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`}
                />
              </div>
            </>
          )}
        </div>

        {/* Email prompt overlay — shown when contact has no email */}
        {showEmailPrompt && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-8 z-30">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-slate-200 p-6 flex flex-col gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900 mb-1">No email address on file</p>
                <p className="text-xs text-slate-500">
                  This contact has no email address. Enter one to send the booking confirmation.
                </p>
              </div>
              <input
                type="email"
                autoFocus
                value={promptEmail}
                onChange={e => setPromptEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && promptEmail.trim()) handleEmailPromptConfirm() }}
                placeholder="Email address"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEmailPromptConfirm}
                  disabled={savingEmail || !promptEmail.trim()}
                  className="flex-1 px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
                >
                  {savingEmail ? 'Saving…' : 'Confirm & send'}
                </button>
                <button
                  onClick={() => setShowEmailPrompt(false)}
                  className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          {pane === 'ticket' && (
            <>
              <button
                onClick={handleCreateTicket}
                disabled={ticketMutation.isPending}
                className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
              >
                {ticketMutation.isPending ? 'Creating…' : 'Create ticket'}
              </button>
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </>
          )}
          {pane === 'booking' && (
            <>
              <button
                onClick={handleSendBooking}
                disabled={sending || !bookingContact}
                className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
              >
                {sending ? 'Sending…' : 'Send booking link'}
              </button>
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
