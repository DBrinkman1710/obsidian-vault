import { useState } from 'react'
import { toast } from 'sonner'
import { Clock, Plus, X } from 'lucide-react'
import { useT } from '../../../hooks/useT'

export interface SlotEntry {
  time: string
  end_time: string
  capacity: number
}

const DAY_KEYS = [
  'booking_day_monday',
  'booking_day_tuesday',
  'booking_day_wednesday',
  'booking_day_thursday',
  'booking_day_friday',
  'booking_day_saturday',
  'booking_day_sunday',
] as const

/**
 * Weekly availability grid — one card per weekday, each holding time ranges.
 * Shared by the worker self-service page and the admin "edit worker" modal.
 * `slots` is keyed "0"–"6" (Mon–Sun).
 */
export function WeekAvailabilityEditor({
  slots,
  onChange,
}: {
  slots: Record<string, SlotEntry[]>
  onChange: (slots: Record<string, SlotEntry[]>) => void
}) {
  const t = useT()

  function setDay(dayKey: string, list: SlotEntry[]) {
    onChange({ ...slots, [dayKey]: list })
  }

  return (
    <div className="space-y-2.5">
      {DAY_KEYS.map((key, i) => (
        <DayCard
          key={i}
          label={t(key)}
          entries={slots[String(i)] ?? []}
          onChange={list => setDay(String(i), list)}
        />
      ))}
    </div>
  )
}

function DayCard({
  label,
  entries,
  onChange,
}: {
  label: string
  entries: SlotEntry[]
  onChange: (list: SlotEntry[]) => void
}) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')

  function commit() {
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end <= start) {
      toast.error(t('booking_err_end_after_start'))
      return
    }
    if (entries.some(e => e.time === start)) {
      setAdding(false)
      return
    }
    const next = [...entries, { time: start, end_time: end, capacity: 1 }].sort((a, b) =>
      a.time.localeCompare(b.time),
    )
    onChange(next)
    setAdding(false)
  }

  function remove(idx: number) {
    onChange(entries.filter((_, i) => i !== idx))
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-ink w-24 shrink-0">{label}</span>
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 justify-end">
          {entries.length === 0 && !adding && (
            <span className="text-xs text-slate-300">{t('booking_not_working')}</span>
          )}
          {entries.map((e, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg border border-brand-100"
            >
              <Clock className="h-3 w-3" />
              {e.time}–{e.end_time}
              <button
                onClick={() => remove(idx)}
                className="ml-0.5 text-brand-400 hover:text-red-500 transition-colors"
                title={t('booking_wg_remove')}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80 border border-brand-200 rounded-lg px-2 py-1 transition-opacity"
              aria-label={t('booking_wg_aria_add_hours').replace('{day}', label)}
            >
              <Plus className="h-3 w-3" /> {t('booking_wg_btn_add')}
            </button>
          )}
        </div>
      </div>
      {adding && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <input
            type="time"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-yippie/40"
          />
          <span className="text-xs text-slate-400">{t('booking_wg_to')}</span>
          <input
            type="time"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-yippie/40"
          />
          <button
            onClick={commit}
            className="px-3 py-1.5 bg-yippie text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('booking_wg_btn_add')}
          </button>
          <button
            onClick={() => setAdding(false)}
            className="px-2 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            {t('booking_wg_btn_cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
