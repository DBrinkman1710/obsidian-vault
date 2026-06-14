import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../../api/client'

interface PipelineStage {
  id: string
  name: string
  color: string
  display_order: number
  contact_count: number
}

interface ActivityEventOut {
  id: string
  module: string
  event_type: string
  entity_type: string
  entity_id: string | null
  contact_id: string | null
  actor_id: string | null
  actor_name: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

const STAT_CARDS = [
  { key: 'today',     label: 'Today',      colorClass: 'text-blue-600',   bgClass: 'bg-blue-50 border-blue-100' },
  { key: 'this_week', label: 'This week',  colorClass: 'text-violet-600', bgClass: 'bg-violet-50 border-violet-100' },
  { key: 'total',     label: 'All time',   colorClass: 'text-slate-600',  bgClass: 'bg-slate-50 border-slate-200' },
]

const EVENT_LABELS: Record<string, string> = {
  'email.replied':         'Replied to email',
  'email.composed':        'Sent email',
  'ticket_created':        'Created ticket',
  'ticket_status_changed': 'Changed ticket status',
  'ticket_assigned':       'Assigned ticket',
  'ticket_commented':      'Added comment',
  'pipeline_stage_changed': 'Moved pipeline stage',
}

const MODULE_DOT: Record<string, string> = {
  inbox:    'bg-blue-500',
  tickets:  'bg-violet-500',
  pipeline: 'bg-emerald-500',
}

function humanize(key: string) {
  return key.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function eventLink(ev: ActivityEventOut): string | null {
  if (ev.entity_type === 'ticket' && ev.entity_id) return `/tickets/${ev.entity_id}`
  const draftId = ev.payload?.draft_id
  if (draftId) return `/inbox/drafts/${draftId}`
  return null
}

function eventLabel(ev: ActivityEventOut): string {
  if (ev.event_type === 'pipeline_stage_changed') {
    const stageName = ev.payload?.stage_name
    if (typeof stageName === 'string') return `Moved to ${stageName}`
  }
  return EVENT_LABELS[ev.event_type] ?? humanize(ev.event_type)
}

function EventRow({ ev, last }: { ev: ActivityEventOut; last: boolean }) {
  const label = eventLabel(ev)
  const dot = MODULE_DOT[ev.module] ?? 'bg-slate-400'
  const href = eventLink(ev)

  const inner = (
    <div className={`flex items-start gap-4 px-5 py-4 ${!last ? 'border-b border-slate-100' : ''}`}>
      <span className={`w-2 h-2 rounded-full ${dot} mt-1.5 shrink-0`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900 truncate">
          <span className="font-semibold">{label}</span>
          {ev.actor_name && (
            <span className="text-slate-500 font-normal"> · {ev.actor_name}</span>
          )}
        </p>
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
          {new Date(ev.created_at).toLocaleString()}
          {ev.module && (
            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{ev.module}</span>
          )}
        </p>
      </div>
    </div>
  )

  if (href) {
    return (
      <Link to={href} className="block hover:bg-slate-50 transition-colors">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}

export default function ActivityFeed() {
  const [stageId, setStageId] = useState<string | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: () => api.get('/activity/stats').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then(r => r.data),
  })

  const { data: events, isLoading } = useQuery<ActivityEventOut[]>({
    queryKey: ['activity', stageId],
    queryFn: () =>
      api
        .get('/activity', { params: stageId ? { pipeline_stage_id: stageId } : {} })
        .then(r => r.data),
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

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Recent Events</p>

      {stages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setStageId(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              stageId === null
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {stages.map(s => (
            <button
              key={s.id}
              onClick={() => setStageId(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                stageId === s.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
        </div>
      )}

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
        {events && events.length > 0 && events.map((ev, i) => (
          <EventRow key={ev.id} ev={ev} last={i === events.length - 1} />
        ))}
      </div>
    </div>
  )
}
