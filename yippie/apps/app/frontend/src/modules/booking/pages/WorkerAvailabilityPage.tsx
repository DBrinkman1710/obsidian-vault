import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LogOut, CalendarDays } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { WeekAvailabilityEditor, type SlotEntry } from '../components/WeekAvailabilityEditor'

interface WorkerAvailability {
  weekly_slots: Record<string, SlotEntry[]> | null
  timezone: string | null
  is_active: boolean
}

const TIMEZONES = [
  'Europe/Amsterdam',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'America/New_York',
  'America/Los_Angeles',
]

export default function WorkerAvailabilityPage() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<WorkerAvailability>({
    queryKey: ['my-availability'],
    queryFn: () => api.get('/worker/my-availability').then((r: any) => r.data),
  })

  const [slots, setSlots] = useState<Record<string, SlotEntry[]>>({})
  const [isActive, setIsActive] = useState(true)
  const [tz, setTz] = useState('Europe/Amsterdam')
  const [showTz, setShowTz] = useState(false)

  // Seed local editor state once the saved availability loads.
  useEffect(() => {
    if (!data) return
    setSlots((data.weekly_slots as Record<string, SlotEntry[]>) ?? {})
    setIsActive(data.is_active)
    setTz(data.timezone || 'Europe/Amsterdam')
  }, [data])

  const saveMut = useMutation({
    mutationFn: (body: Partial<WorkerAvailability>) =>
      api.put('/worker/my-availability', body).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-availability'] })
      toast.success('Availability saved')
    },
    onError: () => toast.error('Could not save. Please try again.'),
  })

  const totalSlots = useMemo(
    () => Object.values(slots).reduce((n, list) => n + (list?.length ?? 0), 0),
    [slots],
  )

  function save() {
    saveMut.mutate({ weekly_slots: slots, timezone: tz, is_active: isActive })
  }

  const firstName = (user?.full_name || 'there').split(' ')[0]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto w-full px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-yippie flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-white" strokeWidth={2.2} />
            </div>
            <span className="heading-md text-ink">Availability</span>
          </div>
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-6 pb-28">
        <h1 className="heading-xl text-ink">
          Hi {firstName} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Add the hours you can take jobs. Customers only see slots you've opened.
        </p>

        {/* Available toggle */}
        <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5">
          <div>
            <p className="text-sm font-semibold text-ink">I'm available for bookings</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Turn this off to pause new bookings without deleting your hours.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              isActive ? 'bg-yippie' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Week editor */}
        <div className={`mt-5 transition-opacity ${isActive ? '' : 'opacity-50'}`}>
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <WeekAvailabilityEditor slots={slots} onChange={setSlots} />
          )}
        </div>

        {/* Timezone (advanced) */}
        <div className="mt-6">
          <button
            onClick={() => setShowTz(v => !v)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
          >
            {showTz ? '− Hide' : '+'} Timezone ({tz})
          </button>
          {showTz && (
            <select
              value={tz}
              onChange={e => setTz(e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/40 focus:border-yippie"
            >
              {[...new Set([tz, ...TIMEZONES])].map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          )}
        </div>
      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-slate-200">
        <div className="max-w-2xl mx-auto w-full px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {totalSlots} time slot{totalSlots === 1 ? '' : 's'} across the week
          </span>
          <button
            onClick={save}
            disabled={saveMut.isPending}
            className="px-5 py-2.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {saveMut.isPending ? 'Saving…' : 'Save availability'}
          </button>
        </div>
      </div>
    </div>
  )
}
