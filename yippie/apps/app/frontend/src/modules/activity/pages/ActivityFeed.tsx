import { useState, useMemo } from 'react'
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

interface AgentKpi {
  agent_id: string
  agent_name: string
  emails_sent: number
  emails_opened: number
  tickets_assigned: number
  tickets_resolved_this_week: number
  avg_resolution_hours: number | null
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

const EVENTS_PER_PAGE = 10

export default function ActivityFeed() {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null)
  const [eventsPage, setEventsPage] = useState(0)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all')

  const { data: kpis, isLoading, isError } = useQuery<Kpis>({
    queryKey: ['activity-kpis'],
    queryFn: () => api.get('/activity/kpis').then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  const { data: agentKpis } = useQuery<AgentKpi[]>({
    queryKey: ['activity-agent-kpis'],
    queryFn: () => api.get('/activity/agent-kpis').then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  const agentStats = useMemo(() => {
    if (!agentKpis || agentKpis.length === 0) return null
    if (selectedAgentId === 'all') {
      const totalSent = agentKpis.reduce((s: number, a: AgentKpi) => s + a.emails_sent, 0)
      const totalOpened = agentKpis.reduce((s: number, a: AgentKpi) => s + a.emails_opened, 0)
      const withHours = agentKpis.filter((a: AgentKpi) => a.avg_resolution_hours !== null)
      return {
        agent_name: 'All agents',
        emails_sent: totalSent,
        open_rate: totalSent > 0 ? totalOpened / totalSent : null,
        tickets_assigned: agentKpis.reduce((s: number, a: AgentKpi) => s + a.tickets_assigned, 0),
        tickets_resolved_this_week: agentKpis.reduce((s: number, a: AgentKpi) => s + a.tickets_resolved_this_week, 0),
        avg_resolution_hours: withHours.length > 0
          ? Math.round((withHours.reduce((s: number, a: AgentKpi) => s + a.avg_resolution_hours!, 0) / withHours.length) * 10) / 10
          : null,
      }
    }
    const agent = agentKpis.find((a: AgentKpi) => a.agent_id === selectedAgentId)
    if (!agent) return null
    return {
      agent_name: agent.agent_name,
      emails_sent: agent.emails_sent,
      open_rate: agent.emails_sent > 0 ? agent.emails_opened / agent.emails_sent : null,
      tickets_assigned: agent.tickets_assigned,
      tickets_resolved_this_week: agent.tickets_resolved_this_week,
      avg_resolution_hours: agent.avg_resolution_hours,
    }
  }, [agentKpis, selectedAgentId])

  const { data: stages } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
  })

  const { data: events } = useQuery<ActivityEvent[]>({
    queryKey: ['activity-events', selectedStageId],
    queryFn: () =>
      api
        .get('/activity', {
          params: { pipeline_stage_id: selectedStageId || undefined, limit: 500 },
        })
        .then((r: any) => r.data),
  })

  const allEvents = events ?? []
  const eventPageCount = Math.max(1, Math.ceil(allEvents.length / EVENTS_PER_PAGE))
  const safePage = Math.min(eventsPage, eventPageCount - 1)
  const pageEvents = allEvents.slice(safePage * EVENTS_PER_PAGE, (safePage + 1) * EVENTS_PER_PAGE)

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Activity</h1>

      {isLoading && <LoadingState />}

      {!isLoading && isError && (
        <div className={`${CARD} text-sm text-slate-500 py-8 text-center`}>
          Could not load activity data. Please refresh.
        </div>
      )}

      {!isLoading && kpis && (
        <div className="space-y-8">
          {/* Pipeline */}
          <section>
            <p className={SECTION_HEADER}>Pipeline</p>
            {kpis.pipeline.length === 0 ? (
              <div className={`${CARD} text-sm text-slate-400`}>No pipeline stages yet</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {kpis.pipeline.map((stage: any) => (
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
                        ? 'avg days in stage'
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

          {/* Agent performance */}
          {agentKpis && agentKpis.length > 0 && agentStats && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <p className={SECTION_HEADER} style={{ marginBottom: 0 }}>Agent performance</p>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All agents</option>
                  {agentKpis.map((a: AgentKpi) => (
                    <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
                  ))}
                </select>
              </div>
              <div className={CARD}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Emails sent</p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{agentStats.emails_sent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Open rate</p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {agentStats.open_rate === null ? '—' : `${Math.round(agentStats.open_rate * 1000) / 10}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Tickets assigned</p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{agentStats.tickets_assigned}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Resolved this week</p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{agentStats.tickets_resolved_this_week}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Avg resolution (hrs)</p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {agentStats.avg_resolution_hours === null ? '—' : agentStats.avg_resolution_hours}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Recent activity */}
          <section>
            <p className={SECTION_HEADER}>Recent activity</p>

            {stages && stages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <button
                  onClick={() => { setSelectedStageId(null); setEventsPage(0) }}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${selectedStageId === null ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                >
                  All
                </button>
                {stages.map((stage: any) => (
                  <button
                    key={stage.id}
                    onClick={() => { setSelectedStageId(selectedStageId === stage.id ? null : stage.id); setEventsPage(0) }}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${selectedStageId === stage.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
                    {stage.name}
                  </button>
                ))}
              </div>
            )}

            <div className={CARD}>
              {allEvents.length === 0 ? (
                <p className="text-sm text-slate-400">No activity to show</p>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100">
                    {pageEvents.map((event: any) => (
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
                  {eventPageCount > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => setEventsPage(p => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ← Prev
                      </button>
                      <span className="text-xs text-slate-500 font-medium">
                        {safePage + 1} / {eventPageCount}
                      </span>
                      <button
                        onClick={() => setEventsPage(p => Math.min(eventPageCount - 1, p + 1))}
                        disabled={safePage >= eventPageCount - 1}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
