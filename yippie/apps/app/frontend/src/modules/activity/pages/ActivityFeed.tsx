import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

interface PipelineStage {
  id: string
  name: string
  color: string
  display_order: number
}

interface ActivityEvent {
  id: string
  contact_id: string | null
  actor_name: string | null
  module: string
  event_type: string
  created_at: string
}

interface PipelineKpi {
  stage_id: string
  stage_name: string
  color: string
  contact_count: number
  avg_days_in_stage: number | null
}

interface Kpis {
  pipeline: PipelineKpi[]
  email: {
    sent_total: number
    sent_this_week: number
    delivered: number
    opened: number
    open_rate: number
    bounced: number
  }
  tickets: {
    open: number
    in_progress: number
    resolved_this_week: number
    avg_resolution_hours: number | null
  }
  contacts: {
    total: number
    new_this_week: number
  }
}

const CARD = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6'
const SECTION_HEADER = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4'
const BIG = 'text-3xl font-extrabold text-slate-900'
const SUB = 'text-sm text-slate-500'

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

function LoadingState() {
  return (
    <div className="space-y-8">
      <div>
        <SkeletonBar className="h-3 w-24 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={CARD}>
              <SkeletonBar className="h-3 w-20 mb-4" />
              <SkeletonBar className="h-8 w-16 mb-2" />
              <SkeletonBar className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className={CARD}>
            <SkeletonBar className="h-3 w-24 mb-6" />
            <div className="space-y-4">
              {[0, 1, 2, 3].map(j => (
                <div key={j} className="flex justify-between items-center">
                  <SkeletonBar className="h-3 w-24" />
                  <SkeletonBar className="h-6 w-10" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={SUB}>{label}</span>
      <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</span>
    </div>
  )
}

export default function ActivityFeed() {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)

  const { data: kpis, isLoading } = useQuery<Kpis>({
    queryKey: ['activity-kpis'],
    queryFn: () => api.get('/activity/kpis').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then(r => r.data),
  })

  const { data: events } = useQuery<ActivityEvent[]>({
    queryKey: ['activity-events', selectedStageId],
    queryFn: () =>
      api
        .get('/activity', {
          params: { pipeline_stage_id: selectedStageId || undefined, limit: 100 },
        })
        .then(r => r.data),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Activity</h1>

      {isLoading && <LoadingState />}

      {!isLoading && kpis && (
        <div className="space-y-8">
          {/* Pipeline */}
          <section>
            <p className={SECTION_HEADER}>Pipeline</p>
            {kpis.pipeline.length === 0 ? (
              <div className={`${CARD} text-sm text-slate-400`}>No pipeline stages yet</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {kpis.pipeline.map(stage => (
                  <div key={stage.stage_id} className={CARD}>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: stage.color }}
                      />
                      <span className="text-sm font-semibold text-slate-700 truncate">
                        {stage.stage_name}
                      </span>
                    </div>
                    <p className={BIG}>{stage.contact_count}</p>
                    <p className={`${SUB} mt-1`}>
                      {stage.avg_days_in_stage === null
                        ? 'avg — days in stage'
                        : `avg ${stage.avg_days_in_stage} days in stage`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Email / Tickets / Contacts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={CARD}>
              <p className={SECTION_HEADER}>Email</p>
              <div className="space-y-4">
                <KpiRow label="Sent total" value={fmt(kpis.email.sent_total)} />
                <KpiRow label="Sent this week" value={fmt(kpis.email.sent_this_week)} />
                <KpiRow
                  label="Open rate"
                  value={
                    kpis.email.sent_total === 0
                      ? '—'
                      : `${Math.round(kpis.email.open_rate * 1000) / 10}%`
                  }
                />
                <KpiRow label="Bounced" value={fmt(kpis.email.bounced)} />
              </div>
            </div>

            <div className={CARD}>
              <p className={SECTION_HEADER}>Tickets</p>
              <div className="space-y-4">
                <KpiRow label="Open" value={fmt(kpis.tickets.open)} />
                <KpiRow label="In progress" value={fmt(kpis.tickets.in_progress)} />
                <KpiRow label="Resolved this week" value={fmt(kpis.tickets.resolved_this_week)} />
                <KpiRow
                  label="Avg resolution (hours)"
                  value={fmt(kpis.tickets.avg_resolution_hours)}
                />
              </div>
            </div>

            <div className={CARD}>
              <p className={SECTION_HEADER}>Contacts</p>
              <div className="space-y-4">
                <KpiRow label="Total contacts" value={fmt(kpis.contacts.total)} />
                <KpiRow label="New this week" value={fmt(kpis.contacts.new_this_week)} />
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <section>
            <p className={SECTION_HEADER}>Recent activity</p>

            {stages && stages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <button
                  onClick={() => setSelectedStageId(null)}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${selectedStageId === null ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                >
                  All
                </button>
                {stages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setSelectedStageId(selectedStageId === stage.id ? null : stage.id)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${selectedStageId === stage.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
                    {stage.name}
                  </button>
                ))}
              </div>
            )}

            <div className={CARD}>
              {!events || events.length === 0 ? (
                <p className="text-sm text-slate-400">No activity to show</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {events.map(event => (
                    <li key={event.id} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                      <span className="text-sm text-slate-700 truncate">
                        <span className="font-semibold text-slate-900">{event.actor_name ?? 'System'}</span>
                        {' '}
                        <span className="text-slate-500">{event.event_type.replace(/[._]/g, ' ')}</span>
                      </span>
                      <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
