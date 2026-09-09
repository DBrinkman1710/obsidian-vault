import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Edit2, ExternalLink, Plus, Settings2, Trash2, User, UserPlus, Users, X } from 'lucide-react'
import { CloseButton } from '../../../shell/CloseButton'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useTenantConfig } from '../../../App'
import { useAuth } from '../../../auth/useAuth'
import SendBookingModal from '../../booking/components/SendBookingModal'
import ContactPeekModal from '../../../components/ContactPeekModal'
import TicketPeekModal from '../../../components/TicketPeekModal'
import { useCompose } from '../../../hooks/useCompose'
import { useT } from '../../../hooks/useT'

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
  invitation_status: string | null
  is_invited: boolean
}

interface InvitationOut {
  id: string
  event_id: string
  invitee_id: string
  invitee_name: string
  invitee_email: string
  status: string
  counter_proposed_slots: Array<{ start: string; end: string }> | null
  message: string | null
  created_at: string
}

interface PendingInvitation {
  id: string
  event_id: string
  event_title: string
  event_start_at: string
  event_end_at: string | null
  event_all_day: boolean
  organiser_name: string
  status: string
  counter_proposed_slots: Array<{ start: string; end: string }> | null
  message: string | null
  created_at: string
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

type CalendarTypeFilter = 'shared' | 'personal'

interface PickerOption { id: string; label: string }

const WEEKDAYS = ['cal_wd_mon', 'cal_wd_tue', 'cal_wd_wed', 'cal_wd_thu', 'cal_wd_fri', 'cal_wd_sat', 'cal_wd_sun']
const inputCls = 'input-base'
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
  const t = useT()
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
            <p className="px-3 py-2 text-sm text-slate-400">{t('cal_searching')}</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">{t('cal_no_matches')}</p>
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
  const t = useT()
  const [q, setQ] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['calendar-contact-search', q],
    queryFn: () => api.get<{ items: { id: string; full_name: string; email: string | null }[] }>(
      '/contacts', { params: { search: q, limit: 10 } }).then((r: any) => r.data.items),
    enabled: q.trim().length > 0,
  })
  const options = (data ?? []).map((c: any) => ({ id: c.id, label: c.email ? `${c.full_name} (${c.email})` : c.full_name }))
  return <Picker label={t('cal_label_contact')} placeholder={t('cal_placeholder_contact')}
    selected={selected} onSelect={onSelect} options={options} loading={isFetching} onQueryChange={setQ} />
}

function TicketPicker({ selected, onSelect }: {
  selected: PickerOption | null
  onSelect: (opt: PickerOption | null) => void
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const { data, isFetching } = useQuery({
    queryKey: ['calendar-ticket-options'],
    queryFn: () => api.get<{ items: { id: string; subject: string }[] }>(
      '/tickets', { params: { limit: 100 } }).then((r: any) => r.data.items),
  })
  const term = q.trim().toLowerCase()
  const options = (data ?? [])
    .filter((tk: any) => tk.subject.toLowerCase().includes(term))
    .slice(0, 10)
    .map((tk: any) => ({ id: tk.id, label: tk.subject }))
  return <Picker label={t('cal_label_ticket')} placeholder={t('cal_placeholder_ticket')}
    selected={selected} onSelect={onSelect} options={options} loading={isFetching} onQueryChange={setQ} />
}

function UserPicker({ selected, onSelect, excludeIds }: {
  selected: PickerOption[]
  onSelect: (opts: PickerOption[]) => void
  excludeIds?: string[]
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<number | undefined>(undefined)

  const { data: members = [] } = useQuery<{ id: string; full_name: string; email: string }[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get('/team/members').then((r: any) => r.data),
  })

  const term = q.trim().toLowerCase()
  const typedMembers = members as { id: string; full_name: string; email: string }[]
  const options = typedMembers
    .filter(u => !excludeIds?.includes(u.id))
    .filter(u => !selected.some(s => s.id === u.id))
    .filter(u => !term || u.full_name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
    .slice(0, 10)
    .map(u => ({ id: u.id, label: `${u.full_name} (${u.email})` }))

  function add(opt: PickerOption) {
    onSelect([...selected, opt])
    setQ('')
    setOpen(false)
  }
  function remove(id: string) {
    onSelect(selected.filter(s => s.id !== id))
  }

  return (
    <div>
      <label className={labelCls}>{t('cal_label_invite_teammates')}</label>
      <div className="relative">
        <input
          className={inputCls}
          placeholder={t('cal_placeholder_teammates')}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150) }}
        />
        {open && (
          <div className="absolute z-10 mt-1 w-full max-h-44 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">{term ? t('cal_no_matches') : t('cal_no_teammates')}</p>
            ) : options.map(opt => (
              <button key={opt.id} type="button"
                onMouseDown={() => { window.clearTimeout(blurTimer.current); add(opt) }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 truncate">
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(s => (
            <span key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-100">
              {s.label.split(' (')[0]}
              <button type="button" onClick={() => remove(s.id)}
                className="ml-0.5 text-blue-400 hover:text-red-500 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

const STATUS_CHIP: Record<string, string> = {
  proposed: 'bg-slate-100 text-slate-600',
  accepted: 'bg-green-50 text-green-700',
  declined: 'bg-red-50 text-red-600',
  counter_proposed: 'bg-amber-50 text-amber-700',
}
const STATUS_LABEL: Record<string, string> = {
  proposed: 'cal_status_invited',
  accepted: 'cal_status_accepted',
  declined: 'cal_status_declined',
  counter_proposed: 'cal_status_counter_proposed',
}

function EventModal({ event, onClose, onSaved, defaultDate, bookingEnabled }: {
  event: CalendarItem | null   // null = create
  onClose: () => void
  onSaved: () => void
  defaultDate?: Date
  bookingEnabled?: boolean
}) {
  const t = useT()
  const { user } = useAuth()
  const qc = useQueryClient()
  const isCreate = !event
  const showTabs = isCreate && bookingEnabled

  const [tab, setTab] = useState<'event' | 'booking'>('event')

  // ── Event tab state ──────────────────────────────────────────────────────
  const start = event ? new Date(event.start_at) : null
  const end = event?.end_at ? new Date(event.end_at) : null

  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(start ? toDateInput(start) : defaultDate ? toDateInput(defaultDate) : toDateInput(new Date()))
  const [time, setTime] = useState(start && !event?.all_day ? toTimeInput(start) : defaultDate ? '12:00' : '09:00')
  const [endDate, setEndDate] = useState(end ? toDateInput(end) : (start ? toDateInput(start) : defaultDate ? toDateInput(defaultDate) : toDateInput(new Date())))
  const [endTime, setEndTime] = useState(end && !event?.all_day ? toTimeInput(end) : (() => {
    const base = defaultDate ? '12:00' : '09:00'
    const h = parseInt(base) + 1
    return `${String(h).padStart(2, '0')}:00`
  })())
  const [allDay, setAllDay] = useState(event?.all_day ?? false)
  const [description, setDescription] = useState(event?.description ?? '')
  const [calendarType, setCalendarType] = useState<'shared' | 'personal'>(
    (event?.calendar_type as 'shared' | 'personal') ?? 'shared')
  const [contact, setContact] = useState<PickerOption | null>(
    event?.contact_id ? { id: event.contact_id, label: event.contact_name ?? 'Linked contact' } : null)
  const [ticket, setTicket] = useState<PickerOption | null>(
    event?.ticket_id ? { id: event.ticket_id, label: event.ticket_subject ?? 'Linked ticket' } : null)
  const [invitees, setInvitees] = useState<PickerOption[]>([])
  const [error, setError] = useState('')

  // ── Booking tab state ────────────────────────────────────────────────────
  const bToday = useMemo(() => new Date(), [])
  const [bContact, setBContact] = useState<PickerOption | null>(null)
  const [bMode, setBMode] = useState<'open' | 'propose'>('open')
  const [bMessage, setBMessage] = useState('')
  const [bStageId, setBStageId] = useState('')
  const [bSending, setBSending] = useState(false)
  const [bSlots, setBSlots] = useState<{ start: string; end: string }[]>([])
  const [bYear, setBYear] = useState(bToday.getFullYear())
  const [bMonth, setBMonth] = useState(bToday.getMonth())
  const [bActiveDay, setBActiveDay] = useState<string | null>(null)
  const [bFromPersonal, setBFromPersonal] = useState(false)

  const { data: bSettings } = useQuery<CalendarSettings>({
    queryKey: ['booking-settings'],
    queryFn: () => api.get('/booking/settings').then((r: any) => r.data),
    enabled: showTabs && tab === 'booking',
  })
  const { data: bStages = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
    enabled: showTabs,
  })

  const bDays = useMemo(() => monthGrid(bYear, bMonth), [bYear, bMonth])
  const bMonthLabel = new Date(bYear, bMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const bTodayKey = dateKey(bToday)

  const bDayChips = useMemo(() => {
    if (!bActiveDay || !bSettings) return []
    const [y, m, d] = bActiveDay.split('-').map(Number)
    const step = bSettings.slot_minutes
    const out: { start: string; end: string }[] = []
    let cursor = new Date(y, m - 1, d, bSettings.work_start_hour, 0, 0)
    const dayEnd = new Date(y, m - 1, d, bSettings.work_end_hour, 0, 0)
    while (cursor.getTime() + step * 60000 <= dayEnd.getTime()) {
      const s = new Date(cursor)
      const e = new Date(cursor.getTime() + step * 60000)
      out.push({ start: s.toISOString(), end: e.toISOString() })
      cursor = e
    }
    return out
  }, [bActiveDay, bSettings])

  function bToggleSlot(slot: { start: string; end: string }) {
    setBSlots(prev =>
      prev.some(s => s.start === slot.start)
        ? prev.filter(s => s.start !== slot.start)
        : [...prev, slot])
  }

  function bShiftMonth(delta: number) {
    const dt = new Date(bYear, bMonth + delta, 1)
    setBYear(dt.getFullYear()); setBMonth(dt.getMonth())
  }

  async function handleBookingSend() {
    if (!bContact) { setError(t('cal_bk_err_select_contact')); return }
    if (bMode === 'propose' && bSlots.length === 0) { setError(t('cal_bk_err_add_time')); return }
    setBSending(true); setError('')
    try {
      await api.post('/booking/send', {
        contact_id: bContact.id,
        mode: bMode,
        message: bMessage.trim() || undefined,
        proposed_slots: bMode === 'propose' ? bSlots : undefined,
        stage_id_override: bStageId || undefined,
        from_email: bFromPersonal && (user as any)?.reply_from_email ? (user as any).reply_from_email : undefined,
      })
      toast.success(t('cal_bk_success_sent'))
      qc.invalidateQueries({ queryKey: ['booking-tokens'] })
      onClose()
    } catch {
      setError(t('cal_bk_err_send_failed'))
    } finally {
      setBSending(false)
    }
  }

  // ── Existing invitations for edit view ───────────────────────────────────
  const { data: existingInvitations = [] } = useQuery<InvitationOut[]>({
    queryKey: ['event-invitations', event?.id],
    queryFn: () => api.get(`/calendar/events/${event!.id}/invitations`).then((r: any) => r.data),
    enabled: !!event?.id,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: EventPayload) =>
      event ? api.patch(`/calendar/events/${event.id}`, payload) : api.post('/calendar/events', payload),
    onSuccess: async (res: any) => {
      if (!event && invitees.length > 0) {
        const newId = res.data.id
        await api.post(`/calendar/events/${newId}/invitations`, { user_ids: invitees.map(i => i.id) })
        qc.invalidateQueries({ queryKey: ['calendar-invitation-count'] })
      }
      onSaved(); onClose()
    },
    onError: (e: any) => setError(errDetail(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/calendar/events/${event!.id}`),
    onSuccess: () => { onSaved(); onClose() },
    onError: (e: any) => setError(errDetail(e)),
  })

  function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!title.trim()) { setError(t('cal_error_title_required')); return }
    if (!date) { setError(t('cal_error_date_required')); return }
    if (!allDay && !time) { setError(t('cal_error_time_required')); return }

    const startAt = new Date(`${date}T${allDay ? '00:00' : time}`)
    let endAt: Date | null = null
    if (endDate) {
      endAt = new Date(`${endDate}T${allDay ? '23:59' : (endTime || time)}`)
      if (endAt < startAt) { setError(t('cal_error_end_after_start')); return }
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-0 shrink-0">
          <h2 className="text-lg font-bold text-slate-900">{event ? t('cal_modal_edit_title') : t('cal_modal_new_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>

        {/* Tabs — only for create mode when booking module is on */}
        {showTabs && (
          <div className="flex px-8 mt-3 shrink-0 border-b border-slate-200">
            {(['event', 'booking'] as const).map(tabKey => (
              <button
                key={tabKey}
                type="button"
                onClick={() => { setTab(tabKey); setError('') }}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  tab === tabKey ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tabKey === 'event' ? t('cal_tab_event') : t('cal_tab_booking_link')}
              </button>
            ))}
          </div>
        )}

        {/* ── EVENT TAB ─────────────────────────────────────────────────── */}
        {tab === 'event' && (
          <form onSubmit={submit} className="flex flex-col gap-4 overflow-y-auto px-8 pb-8 pt-5">
            <div>
              <label className={labelCls}>{t('cal_label_title')}</label>
              <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)}
                placeholder={t('cal_placeholder_title')} maxLength={255} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('cal_label_date')}</label>
                <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{allDay ? t('cal_label_time') : t('cal_label_time_required')}</label>
                <input type="time" className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                  value={time} onChange={e => setTime(e.target.value)} disabled={allDay} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('cal_label_end_date')}</label>
                <input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{t('cal_label_end_time')}</label>
                <input type="time" className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400`}
                  value={endTime} onChange={e => setEndTime(e.target.value)} disabled={allDay || !endDate} />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-yippie focus:ring-yippie/30 cursor-pointer" />
              <span className="text-sm text-slate-700 font-medium">{t('cal_label_all_day')}</span>
            </label>

            <div>
              <label className={labelCls}>{t('cal_label_visibility')}</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setCalendarType('shared')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${calendarType === 'shared' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {t('cal_visibility_shared')}
                </button>
                <button type="button" onClick={() => setCalendarType('personal')}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${calendarType === 'personal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {t('cal_visibility_personal')}
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>{t('cal_label_description')}</label>
              <textarea className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`}
                value={description} onChange={e => setDescription(e.target.value)} placeholder={t('cal_placeholder_description')} />
            </div>

            <ContactPicker selected={contact} onSelect={setContact} />
            <TicketPicker selected={ticket} onSelect={setTicket} />

            {!event ? (
              <UserPicker
                selected={invitees}
                onSelect={setInvitees}
                excludeIds={user?.id ? [user.id] : []}
              />
            ) : existingInvitations.length > 0 && (
              <div>
                <label className={labelCls}>{t('cal_label_teammates_invited')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {existingInvitations.map((inv: InvitationOut) => (
                    <span key={inv.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-lg border ${STATUS_CHIP[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {inv.invitee_name}
                      <span className="opacity-60 font-normal">· {t(STATUS_LABEL[inv.status] ?? inv.status)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saveMutation.isPending}
                className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity">
                {saveMutation.isPending ? t('cal_btn_saving') : event ? t('cal_btn_save_changes') : t('cal_btn_create_event')}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                {t('cal_btn_cancel')}
              </button>
              {event && (
                <button type="button" disabled={deleteMutation.isPending}
                  onClick={() => { if (confirm(`Delete "${event.title}"?`)) deleteMutation.mutate() }}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                  <Trash2 size={13} /> {t('cal_btn_delete')}
                </button>
              )}
            </div>
          </form>
        )}

        {/* ── BOOKING TAB ───────────────────────────────────────────────── */}
        {tab === 'booking' && (
          <div className="flex flex-col gap-4 overflow-y-auto px-8 pb-8 pt-5">
            {/* Contact picker */}
            <ContactPicker selected={bContact} onSelect={setBContact} />

            {/* Mode */}
            <div className="flex gap-2">
              <button type="button" onClick={() => setBMode('open')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${bMode === 'open' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {t('cal_bk_tab_pick')}
              </button>
              <button type="button" onClick={() => setBMode('propose')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${bMode === 'propose' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {t('cal_bk_tab_propose')}
              </button>
            </div>

            {/* Mini calendar for propose mode */}
            {bMode === 'propose' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-700">{bMonthLabel}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => bShiftMonth(-1)} className="p-1 rounded text-slate-500 hover:bg-slate-100"><ChevronLeft size={15} /></button>
                    <button type="button" onClick={() => bShiftMonth(1)} className="p-1 rounded text-slate-500 hover:bg-slate-100"><ChevronRight size={15} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 px-2 pt-2">
                  {WEEKDAYS.map(wk => (
                    <div key={wk} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-1">{t(wk)}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 px-2 pb-2 gap-0.5">
                  {bDays.map(day => {
                    const key = dateKey(day)
                    const inMonth = day.getMonth() === bMonth
                    const isPast = key < bTodayKey
                    const isActive = key === bActiveDay
                    return (
                      <button key={key} type="button" disabled={isPast} onClick={() => setBActiveDay(key)}
                        className={`h-8 text-xs rounded-lg transition-colors ${
                          isActive ? 'bg-blue-600 text-white font-bold'
                            : isPast ? 'text-slate-300 cursor-not-allowed'
                            : inMonth ? 'text-slate-700 hover:bg-slate-100'
                            : 'text-slate-300 hover:bg-slate-50'}`}>
                        {day.getDate()}
                      </button>
                    )
                  })}
                </div>

                {bActiveDay && (
                  <div className="px-3 py-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">{t('cal_bk_tap_add')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {bDayChips.length === 0 && <p className="text-xs text-slate-400">{t('cal_bk_no_slots_day')}</p>}
                      {bDayChips.map(chip => {
                        const selected = bSlots.some(s => s.start === chip.start)
                        return (
                          <button key={chip.start} type="button" onClick={() => bToggleSlot(chip)}
                            className={`px-2 py-1 text-xs rounded-md border transition-colors ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                            {new Date(chip.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {bSlots.length > 0 && (
                  <div className="px-3 py-3 border-t border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">{t('cal_bk_proposed_count')} ({bSlots.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {bSlots.slice().sort((a, b) => a.start.localeCompare(b.start)).map(s => {
                        const sd = new Date(s.start); const ed = new Date(s.end)
                        const label = `${sd.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ${sd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}–${ed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
                        return (
                          <span key={s.start} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md">
                            {label}
                            <button type="button" onClick={() => bToggleSlot(s)} className="hover:text-blue-900"><X size={11} /></button>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stage override */}
            {bStages.length > 0 && (
              <div>
                <label className={labelCls}>{t('cal_bk_stage_label')}</label>
                <select className={inputCls} value={bStageId} onChange={e => setBStageId(e.target.value)}>
                  <option value="">{t('cal_bk_stage_default')}</option>
                  {bStages.map((s: { id: string; name: string }) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Personal sender */}
            {(user as any)?.reply_from_email && (
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={bFromPersonal} onChange={e => setBFromPersonal(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-yippie focus:ring-yippie/30 cursor-pointer" />
                <span className="text-sm text-slate-700 font-medium">
                  {t('cal_bk_send_from')} <span className="text-slate-500 font-normal">{(user as any).reply_from_email}</span>
                </span>
              </label>
            )}

            {/* Message */}
            <div>
              <label className={labelCls}>{t('cal_bk_message_label')}</label>
              <textarea value={bMessage} onChange={e => setBMessage(e.target.value)}
                placeholder={t('cal_bk_message_placeholder')}
                className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`} />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={handleBookingSend}
                disabled={bSending || !bContact}
                className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity">
                {bSending ? t('cal_bk_btn_sending') : t('cal_bk_btn_send')}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                {t('cal_btn_cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Invitations panel
// ---------------------------------------------------------------------------

function InvitationsPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [counterFor, setCounterFor] = useState<string | null>(null)
  const [counterStart, setCounterStart] = useState('')
  const [counterStartTime, setCounterStartTime] = useState('09:00')
  const [counterEnd, setCounterEnd] = useState('')
  const [counterEndTime, setCounterEndTime] = useState('10:00')

  const { data: invitations = [], isLoading } = useQuery<PendingInvitation[]>({
    queryKey: ['calendar-pending-invitations'],
    queryFn: () => api.get('/calendar/invitations/pending').then((r: any) => r.data),
  })

  const respondMut = useMutation({
    mutationFn: ({ id, status, slots }: { id: string; status: string; slots?: any[] }) =>
      api.patch(`/calendar/invitations/${id}`, { status, counter_proposed_slots: slots }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-pending-invitations'] })
      qc.invalidateQueries({ queryKey: ['calendar-invitation-count'] })
      qc.invalidateQueries({ queryKey: ['calendar-items'] })
      setCounterFor(null)
    },
  })

  function fmtEvent(inv: PendingInvitation) {
    const s = new Date(inv.event_start_at)
    const day = s.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    if (inv.event_all_day) return `${day} (${t('cal_inv_all_day')})`
    const t1 = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    if (!inv.event_end_at) return `${day}, ${t1}`
    const t2 = new Date(inv.event_end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    return `${day}, ${t1}–${t2}`
  }

  function submitCounter(inv: PendingInvitation) {
    if (!counterStart || !counterEnd) return
    const start = new Date(`${counterStart}T${counterStartTime}`)
    const end = new Date(`${counterEnd}T${counterEndTime}`)
    if (end <= start) return
    respondMut.mutate({ id: inv.id, status: 'counter_proposed', slots: [{ start: start.toISOString(), end: end.toISOString() }] })
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus size={16} className="text-slate-400" /> {t('cal_inv_panel_title')}
          </h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
          {isLoading && <p className="px-5 py-8 text-sm text-slate-400 text-center">{t('cal_inv_loading')}</p>}
          {!isLoading && invitations.length === 0 && (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">{t('cal_inv_none_pending')}</p>
          )}
          {invitations.map((inv: PendingInvitation) => (
            <div key={inv.id} className="px-5 py-4">
              <p className="text-sm font-semibold text-slate-800 truncate">{inv.event_title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{fmtEvent(inv)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('cal_inv_invited_by')} {inv.organiser_name}</p>

              {counterFor !== inv.id ? (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => respondMut.mutate({ id: inv.id, status: 'accepted' })}
                    disabled={respondMut.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check size={12} /> {t('cal_inv_btn_accept')}
                  </button>
                  <button
                    onClick={() => respondMut.mutate({ id: inv.id, status: 'declined' })}
                    disabled={respondMut.isPending}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {t('cal_inv_btn_decline')}
                  </button>
                  <button
                    onClick={() => setCounterFor(inv.id)}
                    className="flex-1 px-3 py-1.5 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    {t('cal_inv_btn_propose_time')}
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs font-semibold text-slate-600">{t('cal_inv_propose_alt')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('cal_inv_start_date')}</label>
                      <input type="date" value={counterStart} onChange={e => setCounterStart(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yippie/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('cal_inv_start_time')}</label>
                      <input type="time" value={counterStartTime} onChange={e => setCounterStartTime(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yippie/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('cal_inv_end_date')}</label>
                      <input type="date" value={counterEnd} onChange={e => setCounterEnd(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yippie/30" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('cal_inv_end_time')}</label>
                      <input type="time" value={counterEndTime} onChange={e => setCounterEndTime(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yippie/30" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitCounter(inv)}
                      disabled={respondMut.isPending || !counterStart || !counterEnd}
                      className="flex-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {t('cal_inv_btn_send_proposal')}
                    </button>
                    <button
                      onClick={() => setCounterFor(null)}
                      className="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      {t('cal_inv_btn_cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
  time: string      // HH:MM start
  end_time?: string // HH:MM end
  capacity: number
}

interface CalendarSettings {
  work_start_hour: number
  work_end_hour: number
  slot_minutes: number
  booking_expiry_days: number
  booking_window_days: number
  use_weekly_slots: boolean
  weekly_slots: Record<string, WeeklySlotEntry[]> | null
  cancel_edit_hours_before: number
  min_notice_days: number
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

  const { data: bSettings } = useQuery<{ booking_direction?: string }>({
    queryKey: ['booking-settings'],
    queryFn: () => api.get('/booking/settings').then((r: any) => r.data),
  })
  const requestsMode = bSettings?.booking_direction === 'requests'

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
            <CloseButton onClick={onClose} />
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

        {requestsMode && <RequestsSection />}

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

interface OpenRequest {
  id: string
  contact_name: string | null
  requested_slots: { start: string; end: string }[] | null
  message: string | null
  status: string
  assigned_worker_name: string | null
  chosen_slot_start: string | null
}
interface WorkerLite { user_id: string; full_name: string | null; email: string | null }

function RequestsSection() {
  const qc = useQueryClient()
  const { data: requests = [] } = useQuery<OpenRequest[]>({
    queryKey: ['booking-requests'],
    queryFn: () => api.get('/booking/requests').then((r: any) => r.data),
    refetchInterval: 20000,
  })
  const { data: workers = [] } = useQuery<WorkerLite[]>({
    queryKey: ['booking-workers'],
    queryFn: () => api.get('/booking/workers').then((r: any) => r.data),
  })

  const open = requests.filter(r => r.status === 'open')

  return (
    <div className="border-b border-slate-100 bg-slate-50/50">
      <div className="px-5 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Open requests ({open.length})</p>
      </div>
      {open.length === 0 ? (
        <p className="px-5 pb-4 pt-1 text-xs text-slate-400">No open requests right now.</p>
      ) : (
        <div className="pb-2">
          {open.map(r => <RequestRow key={r.id} req={r} workers={workers} onDone={() => {
            qc.invalidateQueries({ queryKey: ['booking-requests'] })
            qc.invalidateQueries({ queryKey: ['calendar-items'] })
          }} />)}
        </div>
      )}
    </div>
  )
}

function RequestRow({ req, workers, onDone }: { req: OpenRequest; workers: WorkerLite[]; onDone: () => void }) {
  const [workerId, setWorkerId] = useState('')
  const assignMut = useMutation({
    mutationFn: (slot: { start: string; end: string }) =>
      api.post(`/booking/requests/${req.id}/assign`, {
        worker_user_id: workerId, slot_start: slot.start, slot_end: slot.end,
      }),
    onSuccess: onDone,
    onError: (e: any) => alert(e?.response?.data?.detail ?? 'Could not assign'),
  })
  const declineMut = useMutation({
    mutationFn: () => api.post(`/booking/requests/${req.id}/decline`),
    onSuccess: onDone,
  })

  return (
    <div className="px-5 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800 truncate">{req.contact_name ?? 'Unknown'}</p>
        <button onClick={() => { if (confirm('Decline this request?')) declineMut.mutate() }}
          className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-600">Decline</button>
      </div>
      {req.message && <p className="text-xs text-slate-500 mt-0.5">{req.message}</p>}
      <select
        value={workerId}
        onChange={e => setWorkerId(e.target.value)}
        className="mt-2 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-yippie/30"
      >
        <option value="">Assign to worker…</option>
        {workers.map(w => <option key={w.user_id} value={w.user_id}>{w.full_name || w.email}</option>)}
      </select>
      <div className="mt-2 flex flex-col gap-1.5">
        {(req.requested_slots ?? []).map((slot, idx) => (
          <button
            key={idx}
            disabled={!workerId || assignMut.isPending}
            onClick={() => assignMut.mutate(slot)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:border-yippie hover:bg-brand-50 transition-colors text-left disabled:opacity-40"
          >
            <span className="text-xs font-semibold text-slate-700">{fmtSlotShort(slot.start, slot.end)}</span>
            <span className="text-[10px] font-bold text-yippie shrink-0">Assign</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const DAY_LABELS = ['cal_wd_monday', 'cal_wd_tuesday', 'cal_wd_wednesday', 'cal_wd_thursday', 'cal_wd_friday', 'cal_wd_saturday', 'cal_wd_sunday']

function WeeklyGrid({
  slots,
  onChange,
}: {
  slots: Record<string, WeeklySlotEntry[]>
  onChange: (slots: Record<string, WeeklySlotEntry[]>) => void
}) {
  // Per-day inline-add state: {dayKey -> {time, end_time, capacity}}
  const [adding, setAdding] = useState<Record<string, { time: string; end_time: string; capacity: number }>>({})

  function startAdd(dayKey: string) {
    setAdding(prev => ({ ...prev, [dayKey]: { time: '09:00', end_time: '10:00', capacity: 1 } }))
  }

  function cancelAdd(dayKey: string) {
    setAdding(prev => { const n = { ...prev }; delete n[dayKey]; return n })
  }

  function commitAdd(dayKey: string) {
    const entry = adding[dayKey]
    if (!entry) return
    if (!/^\d{2}:\d{2}$/.test(entry.time) || !/^\d{2}:\d{2}$/.test(entry.end_time)) return
    if (entry.end_time <= entry.time) return
    const existing = slots[dayKey] ?? []
    if (existing.some(e => e.time === entry.time)) {
      cancelAdd(dayKey)
      return
    }
    const updated = { ...slots, [dayKey]: [...existing, { time: entry.time, end_time: entry.end_time, capacity: entry.capacity }].sort((a, b) => a.time.localeCompare(b.time)) }
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
                    {entry.time}{entry.end_time ? `–${entry.end_time}` : ''} ×{entry.capacity}
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
              <div className="flex items-center gap-2 mt-1.5 pl-24 flex-wrap">
                <input
                  type="time"
                  value={addState.time}
                  onChange={e => setAdding(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], time: e.target.value } }))}
                  className="px-2 py-1 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie w-28"
                  title="Start time"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="time"
                  value={addState.end_time}
                  onChange={e => setAdding(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], end_time: e.target.value } }))}
                  className="px-2 py-1 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie w-28"
                  title="End time"
                />
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={addState.capacity}
                  onChange={e => setAdding(prev => ({ ...prev, [dayKey]: { ...prev[dayKey], capacity: Math.max(1, Number(e.target.value)) } }))}
                  className="px-2 py-1 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie w-16"
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
          <CloseButton onClick={onClose} />
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
              <label className={labelCls}>Minimum notice required</label>
              <select className={inputCls} value={current.min_notice_days ?? 0}
                onChange={e => update({ min_notice_days: Number(e.target.value) })}>
                <option value={0}>No minimum</option>
                {[1, 2, 3, 5, 7, 14].map(d => <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'} in advance</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Clients cannot book anything within this many days from today.
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
                  use_weekly_slots: current.use_weekly_slots,
                  weekly_slots: current.weekly_slots,
                  cancel_edit_hours_before: current.cancel_edit_hours_before,
                  min_notice_days: current.min_notice_days ?? 0,
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
  const { openCompose } = useCompose()
  const config = useTenantConfig()
  // Pause polling into the 402 wall while the tenant is locked.
  const locked = !!config?.subscription_required
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
  const [calendarTypeFilter, setCalendarTypeFilter] = useState<CalendarTypeFilter>('shared')
  const [bookingsOpen, setBookingsOpen] = useState(false)
  const [invitationsOpen, setInvitationsOpen] = useState(false)
  const [newBookingOpen, setNewBookingOpen] = useState(false)
  const [bookingSettingsOpen, setBookingSettingsOpen] = useState(false)

  // "+ New" dropdown (event / booking)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!newMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setNewMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [newMenuOpen])

  const { data: bookingTokens } = useQuery<BookingToken[]>({
    queryKey: ['booking-tokens'],
    queryFn: () => api.get('/booking/tokens').then((r: any) => r.data),
    enabled: bookingEnabled,
  })
  const pendingCount = (bookingTokens ?? []).filter((t: any) => t.status === 'pending' || t.status === 'counter_proposed').length

  const { data: invCountData } = useQuery<{ count: number }>({
    queryKey: ['calendar-invitation-count'],
    queryFn: () => api.get('/calendar/invitations/pending/count').then((r: any) => r.data),
    refetchInterval: 60_000,
    enabled: !locked,
  })
  const pendingInvitationCount = invCountData?.count ?? 0

  const days = useMemo(() => monthGrid(year, month), [year, month])
  const rangeStart = days[0]
  const rangeEnd = new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate() + 1)

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-items', dateKey(rangeStart), dateKey(rangeEnd), calendarTypeFilter],
    queryFn: () => api.get<{ items: CalendarItem[] }>('/calendar/items', {
      params: {
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
        calendar_type: calendarTypeFilter,
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
        <h1 className="heading-xl text-slate-900">Calendar</h1>
        <div className="flex items-center gap-2">
          {bookingEnabled && (
            <button onClick={() => setBookingsOpen(true)}
              className="relative inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
              <CalendarClock size={15} strokeWidth={2.5} /> Bookings
              {pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-blue-600 rounded-full">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setInvitationsOpen(true)}
            className="relative inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
            <UserPlus size={15} strokeWidth={2.5} /> Invitations
            {pendingInvitationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-blue-600 rounded-full">
                {pendingInvitationCount > 9 ? '9+' : pendingInvitationCount}
              </span>
            )}
          </button>

          {/* + New dropdown — event or booking */}
          <div className="relative" ref={newMenuRef}>
            <button onClick={() => setNewMenuOpen(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">
              <Plus size={15} strokeWidth={2.5} /> New <ChevronDown size={14} />
            </button>
            {newMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                <button
                  onClick={() => { setNewMenuOpen(false); setModal({ open: true, event: null }) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <CalendarClock size={14} className="text-slate-400" /> New event
                </button>
                {bookingEnabled && (
                  <button
                    onClick={() => { setNewMenuOpen(false); setNewBookingOpen(true) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <UserPlus size={14} className="text-slate-400" /> New booking
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Settings — always the last item, all the way right */}
          {bookingEnabled && (
            <button onClick={() => setBookingSettingsOpen(true)}
              className="p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg transition-colors"
              title="Booking settings">
              <Settings2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Shared / Personal slider */}
      <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 mb-4 w-fit">
        {([
          { value: 'shared' as CalendarTypeFilter, label: 'Shared', icon: <Users size={13} /> },
          { value: 'personal' as CalendarTypeFilter, label: 'Personal', icon: <User size={13} />, count: pendingInvitationCount },
        ]).map(m => {
          const displayCount = m.count && m.count > 0 ? (m.count > 9 ? '9+' : String(m.count)) : null
          return (
            <button
              key={m.value}
              onClick={() => setCalendarTypeFilter(m.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                calendarTypeFilter === m.value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {m.icon}
              {m.label}
              {displayCount && (
                <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                  calendarTypeFilter === m.value ? 'bg-white/30 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {displayCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {bookingEnabled && bookingsOpen && (
        <BookingsPanel
          onClose={() => setBookingsOpen(false)}
          onNewBooking={() => setNewBookingOpen(true)}
          onOpenSettings={() => setBookingSettingsOpen(true)}
        />
      )}

      {invitationsOpen && (
        <InvitationsPanel onClose={() => setInvitationsOpen(false)} />
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
                className={`min-h-[96px] p-1.5 border-gray-100 cursor-default ${i % 7 !== 0 ? 'border-l' : ''} ${i >= 7 ? 'border-t' : ''} ${inMonth ? 'bg-white' : 'bg-slate-50/60'}`}
                onDoubleClick={() => { const noon = new Date(day); noon.setHours(12, 0, 0, 0); setModal({ open: true, event: null, defaultDate: noon }) }}
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
                          title={`Deadline: ${item.title}`}
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
                        className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate border transition-colors ${
                          item.is_invited
                            ? 'bg-violet-50 text-violet-700 border-violet-100 hover:bg-violet-100'
                            : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                        }`}>
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
          <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Invited
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
          bookingEnabled={bookingEnabled}
          onClose={() => setModal({ open: false, event: null })}
          onSaved={() => qc.invalidateQueries({ queryKey: ['calendar-items'] })}
        />
      )}
      <ContextMenu state={ctx.state} onClose={ctx.close} />
      <ContactPeekModal
        contactId={peekContactId}
        onClose={() => setPeekContactId(null)}
        onCompose={(email, name) => openCompose({ recipients: [{ email, label: name }], subject: '', body: '', fromEmail: null })}
      />
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
