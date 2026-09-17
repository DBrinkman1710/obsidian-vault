import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Copy, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { useT } from '../../../hooks/useT'

// A bookable timeslot on a specific date.
export interface SlotEntry {
  time: string // HH:MM
  end_time: string // HH:MM
  capacity: number
}
interface DayAvailability {
  date: string // YYYY-MM-DD
  slots: SlotEntry[]
}

// Minimal shape of a calendar event we render faintly behind the slots.
export interface WeekEventItem {
  id: string
  title: string
  start_at: string
  end_at: string | null
  all_day: boolean
  kind: 'event' | 'deadline'
}

interface WeekViewProps {
  anchor: Date
  scope: 'shared' | 'personal'
  canEdit: boolean
  eventsByDay: Map<string, WeekEventItem[]>
  onNavWeek: (delta: number) => void
  onToday: () => void
}

const HOUR_START = 7
const HOUR_END = 21
const HOUR_PX = 44
const GRID_HEIGHT = (HOUR_END - HOUR_START) * HOUR_PX

const WD_KEYS = ['cal_wd_mon', 'cal_wd_tue', 'cal_wd_wed', 'cal_wd_thu', 'cal_wd_fri', 'cal_wd_sat', 'cal_wd_sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
const minToTime = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`

/** ISO 8601 week number (Thursday-based). */
function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

export default function WeekView({ anchor, scope, canEdit, eventsByDay, onNavWeek, onToday }: WeekViewProps) {
  const t = useT()
  const qc = useQueryClient()
  const ctx = useContextMenu()
  const weekStart = useMemo(() => mondayOf(anchor), [anchor])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const weekEnd = days[6]
  const base = scope === 'shared' ? '/booking/availability/exceptions' : '/worker/my-availability/exceptions'

  const queryKey = ['avail-exceptions', scope, dateKey(weekStart), dateKey(weekEnd)]
  const { data: exceptions } = useQuery<DayAvailability[]>({
    queryKey,
    queryFn: () =>
      api
        .get(base, { params: { start: dateKey(weekStart), end: dateKey(weekEnd) } })
        .then((r: any) => r.data),
  })

  // date -> slots, for the visible week
  const slotsByDay = useMemo(() => {
    const map = new Map<string, SlotEntry[]>()
    for (const row of exceptions ?? []) map.set(row.date, row.slots ?? [])
    return map
  }, [exceptions])

  const saveMut = useMutation({
    mutationFn: ({ date, slots }: { date: string; slots: SlotEntry[] }) =>
      api.put(`${base}/${date}`, { slots }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast.error(t('cal_week_save_error')),
  })

  // ── selection + clipboard ────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set()) // `${date}#${time}`
  const [focusedDayOffset, setFocusedDayOffset] = useState<number | null>(null)
  const clipboard = useRef<Array<{ dayOffset: number; time: string; end_time: string; capacity: number }>>([])
  const [rangeModal, setRangeModal] = useState<{ date: string } | null>(null)

  // Clear selection when the week changes.
  useEffect(() => { setSelected(new Set()); setFocusedDayOffset(null) }, [dateKey(weekStart)])

  function saveDay(date: string, slots: SlotEntry[]) {
    // Sort + dedupe by start time.
    const seen = new Set<string>()
    const clean = slots
      .filter(s => (seen.has(s.time) ? false : (seen.add(s.time), true)))
      .sort((a, b) => a.time.localeCompare(b.time))
    saveMut.mutate({ date, slots: clean })
  }

  function addSlot(date: string, time: string, end_time: string, capacity = 1) {
    const existing = slotsByDay.get(date) ?? []
    if (existing.some(s => s.time === time)) return
    saveDay(date, [...existing, { time, end_time, capacity }])
  }

  function deleteSlot(date: string, time: string) {
    const existing = slotsByDay.get(date) ?? []
    saveDay(date, existing.filter(s => s.time !== time))
  }

  function toggleSelect(date: string, time: string, shift: boolean) {
    const key = `${date}#${time}`
    setSelected(prev => {
      const next = new Set(prev)
      if (shift) {
        // Range-select within this day column by start time.
        const dayTimes = (slotsByDay.get(date) ?? []).map(s => s.time).sort()
        const anchorTime = [...prev].filter(k => k.startsWith(`${date}#`)).map(k => k.split('#')[1]).sort().pop()
        if (anchorTime) {
          const lo = Math.min(dayTimes.indexOf(anchorTime), dayTimes.indexOf(time))
          const hi = Math.max(dayTimes.indexOf(anchorTime), dayTimes.indexOf(time))
          for (let i = lo; i <= hi; i++) next.add(`${date}#${dayTimes[i]}`)
          return next
        }
      }
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function doCopy() {
    if (selected.size === 0) { toast.message(t('cal_week_nothing_copied')); return }
    const items: Array<{ dayOffset: number; time: string; end_time: string; capacity: number }> = []
    for (const key of selected) {
      const [date, time] = key.split('#')
      const slot = (slotsByDay.get(date) ?? []).find(s => s.time === time)
      if (!slot) continue
      const offset = days.findIndex(d => dateKey(d) === date)
      items.push({ dayOffset: offset < 0 ? 0 : offset, time: slot.time, end_time: slot.end_time, capacity: slot.capacity })
    }
    clipboard.current = items
    toast.success(t('cal_week_copied').replace('{n}', String(items.length)))
  }

  function doPaste() {
    const items = clipboard.current
    if (!items.length || !canEdit) return
    // Group target -> slots. If a day is focused, everything goes there; else
    // each slot lands on the same weekday offset in the current week.
    const byTarget = new Map<string, SlotEntry[]>()
    for (const it of items) {
      const targetOffset = focusedDayOffset ?? it.dayOffset
      const date = dateKey(days[Math.max(0, Math.min(6, targetOffset))])
      const list = byTarget.get(date) ?? [...(slotsByDay.get(date) ?? [])]
      list.push({ time: it.time, end_time: it.end_time, capacity: it.capacity })
      byTarget.set(date, list)
    }
    let count = 0
    for (const [date, slots] of byTarget) {
      const seen = new Set<string>()
      const clean = slots
        .filter(s => (seen.has(s.time) ? false : (seen.add(s.time), true)))
        .sort((a, b) => a.time.localeCompare(b.time))
      count += clean.length
      saveMut.mutate({ date, slots: clean })
    }
    toast.success(t('cal_week_pasted').replace('{n}', String(count)))
  }

  // Keyboard: Cmd/Ctrl+C copy, Cmd/Ctrl+V paste (ignore while typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (rangeModal) return
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === 'c' || e.key === 'C') { doCopy() }
      else if (e.key === 'v' || e.key === 'V') { doPaste() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i)
  const todayKey = dateKey(new Date())
  const monthYear = `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`

  function emptyCellMenu(e: React.MouseEvent, date: string, hour: number) {
    if (!canEdit) return
    ctx.open(e, [
      { label: t('cal_add_timeslot'), icon: <Plus size={13} />, onClick: () => addSlot(date, `${pad(hour)}:00`, `${pad(hour + 1)}:00`) },
      { label: t('cal_add_range'), icon: <Clock size={13} />, onClick: () => setRangeModal({ date }) },
    ])
  }

  function slotMenu(e: React.MouseEvent, date: string, time: string) {
    if (!canEdit) return
    e.stopPropagation()
    ctx.open(e, [
      { label: t('cal_copy_slots'), icon: <Copy size={13} />, onClick: doCopy },
      { separator: true },
      { label: t('cal_delete_slot'), icon: <Trash2 size={13} />, danger: true, onClick: () => deleteSlot(date, time) },
    ])
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Week nav */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-bold text-slate-800">
          {t('cal_week_label').replace('{n}', String(isoWeek(weekStart)))} · <span className="text-slate-500 font-semibold capitalize">{monthYear}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => onNavWeek(-1)} aria-label={t('cal_prev_week')}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={onToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            {t('cal_today_btn')}
          </button>
          <button onClick={() => onNavWeek(1)} aria-label={t('cal_next_week')}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!canEdit && (
        <div className="px-6 py-2 text-xs text-warning-600 bg-warning-50 border-b border-warning-100">
          {t('cal_week_readonly')}
        </div>
      )}

      {/* Day header row */}
      <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div />
        {days.map((day, i) => {
          const isToday = dateKey(day) === todayKey
          return (
            <div key={i} className="px-2 py-2 text-center border-l border-gray-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{t(WD_KEYS[i])}</div>
              <div className={`text-sm font-bold mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-yippie text-white' : 'text-slate-700'}`}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        {/* hour gutter */}
        <div className="relative" style={{ height: GRID_HEIGHT }}>
          {hours.map(h => (
            <div key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] font-medium text-slate-400"
              style={{ top: (h - HOUR_START) * HOUR_PX }}>
              {pad(h)}:00
            </div>
          ))}
        </div>

        {/* day columns */}
        {days.map((day, colIdx) => {
          const dk = dateKey(day)
          const daySlots = slotsByDay.get(dk) ?? []
          const dayEvents = (eventsByDay.get(dk) ?? []).filter(ev => !ev.all_day && ev.kind === 'event' && ev.end_at)
          const isFocused = focusedDayOffset === colIdx
          return (
            <div key={dk}
              className={`relative border-l border-gray-100 ${isFocused ? 'bg-brand-50/30' : ''}`}
              style={{ height: GRID_HEIGHT }}
              onClick={() => setFocusedDayOffset(colIdx)}>
              {/* hour cells (interaction targets) */}
              {hours.map(h => (
                <div key={h}
                  className="absolute inset-x-0 border-b border-gray-50 hover:bg-slate-50/60"
                  style={{ top: (h - HOUR_START) * HOUR_PX, height: HOUR_PX }}
                  onDoubleClick={() => canEdit && addSlot(dk, `${pad(h)}:00`, `${pad(h + 1)}:00`)}
                  onContextMenu={e => { e.preventDefault(); setFocusedDayOffset(colIdx); emptyCellMenu(e, dk, h) }}
                />
              ))}

              {/* faint existing events */}
              {dayEvents.map(ev => {
                const s = new Date(ev.start_at)
                const e = new Date(ev.end_at as string)
                const startMin = s.getHours() * 60 + s.getMinutes()
                const endMin = e.getHours() * 60 + e.getMinutes()
                const top = ((startMin - HOUR_START * 60) / 60) * HOUR_PX
                const height = Math.max(12, ((endMin - startMin) / 60) * HOUR_PX)
                if (top + height < 0 || top > GRID_HEIGHT) return null
                return (
                  <div key={ev.id}
                    className="absolute left-1 right-1 rounded bg-slate-200/50 border border-slate-300/50 text-[10px] text-slate-500 px-1 overflow-hidden pointer-events-none"
                    style={{ top: Math.max(0, top), height }}
                    title={ev.title}>
                    {ev.title}
                  </div>
                )
              })}

              {/* bookable slots */}
              {daySlots.map(slot => {
                const startMin = timeToMin(slot.time)
                const endMin = timeToMin(slot.end_time)
                const top = ((startMin - HOUR_START * 60) / 60) * HOUR_PX
                const height = Math.max(16, ((endMin - startMin) / 60) * HOUR_PX)
                const isSel = selected.has(`${dk}#${slot.time}`)
                return (
                  <button key={slot.time}
                    onClick={e => { e.stopPropagation(); setFocusedDayOffset(colIdx); if (canEdit) toggleSelect(dk, slot.time, e.shiftKey) }}
                    onContextMenu={e => { e.preventDefault(); setFocusedDayOffset(colIdx); slotMenu(e, dk, slot.time) }}
                    className={`absolute left-1 right-1 rounded-lg border px-1.5 py-0.5 text-left text-[11px] font-semibold overflow-hidden transition-colors ${
                      isSel
                        ? 'bg-yippie text-white border-yippie ring-2 ring-yippie/40'
                        : 'bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100'
                    }`}
                    style={{ top: Math.max(0, top), height }}>
                    <span className="flex items-center gap-1"><Clock size={10} />{slot.time}–{slot.end_time}</span>
                    {slot.capacity > 1 && <span className="opacity-70">×{slot.capacity}</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-6 py-3 border-t border-gray-100 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-brand-200 border border-brand-300" /> {t('cal_week_avail_legend')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-slate-200 border border-slate-300" /> {t('cal_legend_event')}
        </span>
      </div>

      {rangeModal && (
        <AddRangeModal
          onClose={() => setRangeModal(null)}
          onConfirm={(slots) => {
            const date = rangeModal.date
            const existing = slotsByDay.get(date) ?? []
            saveDay(date, [...existing, ...slots])
            setRangeModal(null)
          }}
        />
      )}
      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </div>
  )
}

// --------------------------------------------------------------------------- //
// AddRangeModal — generate consecutive slots from a start/end range.
// --------------------------------------------------------------------------- //
function AddRangeModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (slots: SlotEntry[]) => void }) {
  const t = useT()
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [length, setLength] = useState(60)
  const [capacity, setCapacity] = useState(1)

  const preview = useMemo(() => {
    const out: SlotEntry[] = []
    let cur = timeToMin(start)
    const stop = timeToMin(end)
    if (!(stop > cur) || length < 5) return out
    while (cur + length <= stop) {
      out.push({ time: minToTime(cur), end_time: minToTime(cur + length), capacity })
      cur += length
    }
    return out
  }, [start, end, length, capacity])

  const lengthOptions = [15, 30, 60, 90]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">{t('cal_range_title')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 mb-1">{t('cal_range_start')}</span>
              <input type="time" value={start} onChange={e => setStart(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-500 mb-1">{t('cal_range_end')}</span>
              <input type="time" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40" />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1">{t('cal_range_slot_length')}</span>
            <select value={length} onChange={e => setLength(Number(e.target.value))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40">
              {lengthOptions.map(n => (
                <option key={n} value={n}>{n === 60 ? t('cal_range_hour') : t('cal_range_min').replace('{n}', String(n))}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-500 mb-1">{t('cal_range_capacity')}</span>
            <input type="number" min={1} value={capacity} onChange={e => setCapacity(Math.max(1, Number(e.target.value)))}
              className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/40" />
          </label>
          <p className="text-xs text-slate-400">{preview.length} slots</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            {t('cal_range_cancel')}
          </button>
          <button onClick={() => onConfirm(preview)} disabled={preview.length === 0}
            className="px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-opacity">
            {t('cal_range_generate')}
          </button>
        </div>
      </div>
    </div>
  )
}
