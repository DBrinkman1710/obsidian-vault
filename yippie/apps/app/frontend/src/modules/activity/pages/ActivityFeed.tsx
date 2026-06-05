import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { api } from '../../../api/client'

const STAT_CARDS = [
  { key: 'open',        label: 'Open',           colorClass: 'text-blue-600',   bgClass: 'bg-blue-50 border-blue-100' },
  { key: 'in_progress', label: 'Active',          colorClass: 'text-violet-600', bgClass: 'bg-violet-50 border-violet-100' },
  { key: 'waiting',     label: 'Ready to inform', colorClass: 'text-amber-600',  bgClass: 'bg-amber-50 border-amber-100' },
]

export default function ActivityFeed() {
  const { data: stats } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: () => api.get('/activity/stats').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: events, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get('/activity').then(r => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Activity</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {STAT_CARDS.map(({ key, label, colorClass, bgClass }) => (
          <div key={key} className={`rounded-xl border p-6 ${bgClass}`}>
            <p className={`text-4xl font-extrabold ${colorClass} leading-none mb-2`}>
              {stats?.[key] ?? '—'}
            </p>
            <p className={`text-sm font-semibold ${colorClass} opacity-80`}>{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Events</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading && (
          <p className="text-sm text-slate-400 p-6">Loading…</p>
        )}
        {!isLoading && (!events || events.length === 0) && (
          <div className="py-12 text-center">
            <Activity size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No activity yet</p>
          </div>
        )}
        {events?.map((ev: any, i: number) => (
          <div key={ev.id} className={`flex gap-4 px-5 py-4 ${i < events.length - 1 ? 'border-b border-slate-100' : ''}`}>
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-slate-900">
                <span className="font-semibold">{ev.event_type}</span>
                <span className="text-slate-500"> on {ev.entity_type}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(ev.created_at).toLocaleString()}
                {ev.module && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{ev.module}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
