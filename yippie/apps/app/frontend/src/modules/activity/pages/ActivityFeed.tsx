import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Calendar, CreditCard, FileText, GitBranch, Mail, MessageSquare, Package, Tag, Users, Zap } from 'lucide-react'
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
const BIG = 'text-2xl font-extrabold text-slate-900'
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

function KpiRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={SUB}>{label}</span>
      <span className={`text-2xl font-extrabold tabular-nums ${valueColor ?? 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

/** SVG donut for a single percentage — no chart lib needed. */
function MiniDonut({ pct, color, size = 64 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * c} ${c}`}
      />
    </svg>
  )
}

/** Labelled value with a proportional bar underneath. */
function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-slate-500">{label}</span>
        <span className="text-sm font-bold text-slate-900 tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const MODULE_ICON: Record<string, { Icon: any; color: string; bg: string }> = {
  inbox:     { Icon: Mail,          color: 'text-blue-500',    bg: 'bg-blue-50'    },
  tickets:   { Icon: Tag,           color: 'text-violet-500',  bg: 'bg-violet-50'  },
  contacts:  { Icon: Users,         color: 'text-emerald-500', bg: 'bg-emerald-50' },
  pipeline:  { Icon: GitBranch,     color: 'text-amber-500',   bg: 'bg-amber-50'   },
  chat:      { Icon: MessageSquare, color: 'text-teal-500',    bg: 'bg-teal-50'    },
  billing:   { Icon: CreditCard,    color: 'text-purple-500',  bg: 'bg-purple-50'  },
  bookings:  { Icon: Calendar,      color: 'text-rose-500',    bg: 'bg-rose-50'    },
  contracts: { Icon: FileText,      color: 'text-slate-500',   bg: 'bg-slate-100'  },
  flows:     { Icon: Zap,           color: 'text-yippie',      bg: 'bg-blue-50'    },
  shipments: { Icon: Package,       color: 'text-orange-500',  bg: 'bg-orange-50'  },
}
const DEFAULT_MOD_ICON = { Icon: Activity, color: 'text-slate-400', bg: 'bg-slate-100' }

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

  const openRateVal = kpis && kpis.email.sent_total > 0 ? Math.round(kpis.email.open_rate * 1000) / 10 : null
  // Opened is a positive metric (green when healthy); bounced is negative (red
  // only when it actually happens, neutral at zero) — previously these read as
  // inverted when open rate was low and bounces were zero.
  const openRateHex = openRateVal === null ? '#94a3b8' : openRateVal >= 40 ? '#10b981' : openRateVal >= 20 ? '#f59e0b' : '#94a3b8'
  const avgHoursColor = !kpis?.tickets.avg_resolution_hours ? undefined : kpis.tickets.avg_resolution_hours <= 4 ? 'text-emerald-600' : kpis.tickets.avg_resolution_hours <= 24 ? 'text-amber-500' : 'text-red-600'
  const pipelineTotal = (kpis?.pipeline ?? []).reduce((s, p) => s + p.contact_count, 0)

  const allEvents = events ?? []
  const eventPageCount = Math.max(1, Math.ceil(allEvents.length / EVENTS_PER_PAGE))
  const safePage = Math.min(eventsPage, eventPageCount - 1)
  const pageEvents = allEvents.slice(safePage * EVENTS_PER_PAGE, (safePage + 1) * EVENTS_PER_PAGE)

  return (
    <div>
      <h1 className="heading-xl text-slate-900 mb-6">Activity</h1>

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
              <>
              {/* Stage distribution — one glance shows where contacts sit */}
              {pipelineTotal > 0 && (
                <div className="flex h-3 rounded-full overflow-hidden mb-4 bg-slate-100">
                  {kpis.pipeline.filter((s: any) => s.contact_count > 0).map((s: any) => (
                    <div
                      key={s.stage_id}
                      style={{ width: `${(s.contact_count / pipelineTotal) * 100}%`, background: s.color }}
                      title={`${s.stage_name}: ${s.contact_count}`}
                    />
                  ))}
                </div>
              )}
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
              </>
            )}
          </section>

          {/* Email / Tickets / Contacts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className={CARD}>
              <p className={SECTION_HEADER}>Email</p>
              {/* Open rate donut */}
              <div className="flex items-center gap-4 mb-5">
                <div className="relative">
                  <MiniDonut pct={openRateVal ?? 0} color={openRateHex} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-slate-900 tabular-nums">
                    {openRateVal === null ? '—' : `${openRateVal}%`}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Open rate</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {kpis.email.opened} of {kpis.email.sent_total} emails opened
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <BarRow label="Sent this week" value={kpis.email.sent_this_week} max={kpis.email.sent_total} color="#5BA4F5" />
                <BarRow label="Delivered" value={kpis.email.delivered} max={kpis.email.sent_total} color="#5BA4F5" />
                <BarRow label="Opened" value={kpis.email.opened} max={kpis.email.sent_total} color="#10b981" />
                <BarRow label="Bounced" value={kpis.email.bounced} max={kpis.email.sent_total} color={kpis.email.bounced > 0 ? '#ef4444' : '#e2e8f0'} />
              </div>
            </div>

            <div className={CARD}>
              <p className={SECTION_HEADER}>Tickets</p>
              <div className="space-y-3">
                <BarRow label="Open" value={kpis.tickets.open} max={Math.max(kpis.tickets.open, kpis.tickets.in_progress, kpis.tickets.resolved_this_week)} color="#f59e0b" />
                <BarRow label="In progress" value={kpis.tickets.in_progress} max={Math.max(kpis.tickets.open, kpis.tickets.in_progress, kpis.tickets.resolved_this_week)} color="#5BA4F5" />
                <BarRow label="Resolved this week" value={kpis.tickets.resolved_this_week} max={Math.max(kpis.tickets.open, kpis.tickets.in_progress, kpis.tickets.resolved_this_week)} color="#10b981" />
              </div>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <KpiRow
                  label="Avg resolution (hours)"
                  value={fmt(kpis.tickets.avg_resolution_hours)}
                  valueColor={avgHoursColor}
                />
              </div>
            </div>

            <div className={CARD}>
              <p className={SECTION_HEADER}>Contacts</p>
              <div className="space-y-4">
                <KpiRow label="Total contacts" value={fmt(kpis.contacts.total)} />
              </div>
              <div className="mt-4">
                <BarRow label="New this week" value={kpis.contacts.new_this_week} max={kpis.contacts.total} color="#10b981" />
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
                  className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-yippie/30"
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
                    {pageEvents.map((event: any) => {
                      const mod = MODULE_ICON[event.module] ?? DEFAULT_MOD_ICON
                      return (
                        <li key={event.id} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-2.5 min-w-0 truncate">
                            <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${mod.bg}`}>
                              <mod.Icon size={12} className={mod.color} />
                            </div>
                            <span className="text-sm text-slate-700 truncate">
                              <span className="font-semibold text-slate-900">{event.actor_name ?? 'System'}</span>
                              {' '}
                              <span className="text-slate-500">{event.event_type.replace(/[._]/g, ' ')}</span>
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                            {formatRelative(event.created_at)}
                          </span>
                        </li>
                      )
                    })}
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
