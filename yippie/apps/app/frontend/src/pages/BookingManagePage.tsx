import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../api/client'
import { translations } from '../i18n/translations'

interface Slot { start: string; end: string }
interface AvailableSlot extends Slot { available: boolean }

interface ManageBookingOut {
  tenant_name: string
  contact_first_name: string
  start_at: string
  end_at: string
  locked: boolean
  available_slots: AvailableSlot[]
  cancel_edit_hours_before: number
}

// Dutch-by-default translation helper for this public page.
function tNl(key: string): string {
  return translations.nl[key] ?? translations.en[key] ?? key
}

const WEEKDAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
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
  const day = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
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

type PageState = 'loading' | 'error' | 'locked' | 'ready' | 'rescheduling' | 'cancelled' | 'rescheduled'

export default function BookingManagePage() {
  const { manageToken } = useParams<{ manageToken: string }>()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeDay, setActiveDay] = useState<string | null>(null)
  const [picked, setPicked] = useState<Slot | null>(null)
  const [pageState, setPageState] = useState<PageState>('loading')
  const [actionError, setActionError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading, isError } = useQuery<ManageBookingOut>({
    queryKey: ['manage-booking', manageToken],
    queryFn: (): Promise<ManageBookingOut> => api.get(`/public/booking/manage/${manageToken}`).then((r: any) => r.data as ManageBookingOut),
    retry: false,
    enabled: !!manageToken,
  })

  useEffect(() => {
    if (data && pageState === 'loading') {
      setPageState(data.locked ? 'locked' : 'ready')
    }
  }, [data])

  useEffect(() => {
    if (isError && pageState === 'loading') {
      setPageState('error')
    }
  }, [isError])

  const days = useMemo(() => monthGrid(year, month), [year, month])
  const monthLabel = new Date(year, month, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
  const todayKey = dateKey(today)

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

  async function handleReschedule() {
    if (!picked || !manageToken) return
    setSubmitting(true)
    setActionError(null)
    try {
      await api.post(`/public/booking/manage/${manageToken}/reschedule`, {
        slot_start: picked.start,
        slot_end: picked.end,
      })
      setPageState('rescheduled')
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || tNl('public_manage_err_reschedule'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!manageToken) return
    if (!window.confirm(tNl('public_manage_confirm_cancel'))) return
    setSubmitting(true)
    setActionError(null)
    try {
      await api.post(`/public/booking/manage/${manageToken}/cancel`)
      setPageState('cancelled')
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || tNl('public_manage_err_cancel'))
    } finally {
      setSubmitting(false)
    }
  }

  // Derive effective page state from query + local state
  const effectiveState: PageState = isLoading && pageState === 'loading'
    ? 'loading'
    : isError && pageState === 'loading'
    ? 'error'
    : pageState

  if (effectiveState === 'loading') {
    return <Shell><p className="text-sm text-slate-400 text-center">{tNl('public_manage_loading')}</p></Shell>
  }

  if (effectiveState === 'error' || !data) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-lg font-bold text-slate-900 mb-2">{tNl('public_manage_unavailable_title')}</h1>
          <p className="text-sm text-slate-500">
            {tNl('public_manage_unavailable_body')}
          </p>
        </div>
      </Shell>
    )
  }

  if (effectiveState === 'cancelled') {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">{tNl('public_manage_cancelled_title')}</h1>
          <p className="text-sm text-slate-500">{tNl('public_manage_cancelled_body')}</p>
        </div>
      </Shell>
    )
  }

  if (effectiveState === 'rescheduled') {
    return (
      <Shell>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">{tNl('public_manage_rescheduled_title')}</h1>
          <p className="text-sm text-slate-500">{tNl('public_manage_rescheduled_body')}</p>
        </div>
      </Shell>
    )
  }

  if (effectiveState === 'locked') {
    return (
      <Shell>
        <div className="text-center mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{data.tenant_name}</p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{tNl('public_manage_locked_title')}</h1>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {fmtSlotLong(data.start_at, data.end_at)}
          </p>
          <p className="text-sm text-slate-500 mt-3">
            {tNl('public_manage_locked_body')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {tNl('public_manage_locked_hint').replace('{hours}', String(data.cancel_edit_hours_before))}
          </p>
        </div>
      </Shell>
    )
  }

  if (effectiveState === 'rescheduling') {
    const dayChips = activeDay ? slotsByDay.get(activeDay) ?? [] : []

    return (
      <Shell>
        <div className="text-center mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{data.tenant_name}</p>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{tNl('public_manage_reschedule_title')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {tNl('public_manage_reschedule_current').replace('{slot}', fmtSlotLong(data.start_at, data.end_at))}
          </p>
        </div>

        <button
          onClick={() => { setPageState('ready'); setPicked(null); setActiveDay(null); setActionError(null) }}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors mb-4 block"
        >
          {tNl('public_manage_back')}
        </button>

        {actionError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            {actionError}
          </div>
        )}

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
            {WEEKDAYS_NL.map(d => (
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
            <p className="text-[11px] font-semibold text-slate-400 uppercase mb-2">{tNl('public_manage_available_times')}</p>
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
              {dayChips.length === 0 && <p className="text-xs text-slate-400">{tNl('public_manage_no_times')}</p>}
            </div>
          </div>
        )}

        {picked && (
          <button
            onClick={handleReschedule}
            disabled={submitting}
            className="w-full mt-5 py-2.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {submitting
              ? tNl('public_manage_btn_rescheduling')
              : tNl('public_manage_btn_confirm_reschedule').replace('{slot}', fmtSlotLong(picked.start, picked.end))}
          </button>
        )}
      </Shell>
    )
  }

  // effectiveState === 'ready'
  return (
    <Shell>
      <div className="text-center mb-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{data.tenant_name}</p>
        <h1 className="text-xl font-bold text-slate-900 mt-1">{tNl('public_manage_title')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {tNl('public_manage_greeting').replace('{name}', data.contact_first_name)}
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 text-center">
        <p className="text-sm font-semibold text-slate-700">
          {fmtSlotLong(data.start_at, data.end_at)}
        </p>
      </div>

      {actionError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {actionError}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={() => { setPageState('rescheduling'); setActionError(null) }}
          disabled={submitting}
          className="w-full py-2.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {tNl('public_manage_btn_reschedule')}
        </button>
        <button
          onClick={handleCancel}
          disabled={submitting}
          className="w-full py-2.5 border border-red-200 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {submitting ? tNl('public_manage_btn_cancelling') : tNl('public_manage_btn_cancel')}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400 text-center">
        {tNl('public_manage_changes_hint').replace('{hours}', String(data.cancel_edit_hours_before))}
      </p>
    </Shell>
  )
}
