import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { fmtDate, timeAgo } from '../../../lib/format'
import { Skeleton } from '../../../shell/Skeleton'

const CARD = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6'
const SECTION_HEADER = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4'

interface UserStat {
  user_id: string
  user_name: string
  role: string
  last_login_at: string | null
  emails_sent: number
  open_rate: number | null
  emails_received_personal: number
  tickets_created: number
  tickets_open: number
  tickets_resolved: number
  avg_resolution_hours: number | null
  first_response_minutes: number | null
  chats_handled: number
  chats_solved: number
}

interface DeptStat {
  department_id: string
  department_name: string
  member_count: number
  tickets_created: number
  tickets_open: number
  tickets_resolved: number
  avg_resolution_hours: number | null
}

interface UserStatsResp { period_days: number; users: UserStat[] }
interface DeptStatsResp { period_days: number; shared_emails_received: number; departments: DeptStat[] }

interface ActivityEvent {
  id: string
  actor_name: string | null
  module: string
  event_type: string
  created_at: string
}

const PERIODS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v)
}
function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 1000) / 10}%`
}
function hrs(v: number | null): string {
  return v === null ? '—' : `${v}h`
}
function mins(v: number | null): string {
  if (v === null) return '—'
  if (v < 60) return `${Math.round(v)}m`
  return `${Math.round((v / 60) * 10) / 10}h`
}

const ROLE_STYLE: Record<string, string> = {
  superadmin: 'bg-violet-50 text-violet-600',
  admin: 'bg-blue-50 text-blue-600',
  agent: 'bg-slate-100 text-slate-500',
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function UsersTab() {
  const [days, setDays] = useState<number>(7)
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  const { data: userStats, isLoading: usersLoading } = useQuery<UserStatsResp>({
    queryKey: ['activity-user-stats', days],
    queryFn: () => api.get('/activity/user-stats', { params: { days } }).then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  const { data: deptStats } = useQuery<DeptStatsResp>({
    queryKey: ['activity-department-stats', days],
    queryFn: () => api.get('/activity/department-stats', { params: { days } }).then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  const users = userStats?.users ?? []
  // Default the picker to the first user once data arrives.
  const activeUserId = selectedUserId || users[0]?.user_id || ''
  const selected = useMemo(
    () => users.find(u => u.user_id === activeUserId) ?? null,
    [users, activeUserId],
  )

  const { data: events } = useQuery<ActivityEvent[]>({
    queryKey: ['activity-user-timeline', activeUserId],
    queryFn: () =>
      api.get('/activity', { params: { actor_id: activeUserId, limit: 60 } }).then((r: any) => r.data),
    enabled: !!activeUserId,
  })

  const eventsByDay = useMemo(() => {
    const groups: Record<string, ActivityEvent[]> = {}
    for (const ev of events ?? []) {
      const day = fmtDate(ev.created_at)
      ;(groups[day] ??= []).push(ev)
    }
    return Object.entries(groups)
  }, [events])

  return (
    <div className="space-y-8">
      {/* Period toggle */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Team activity over the last {days} days. Numbers are per user; shared inbox rolls up by department below.
        </p>
        <div className="flex rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                days === p.days ? 'bg-yippie text-white' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Per user dashboard */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className={SECTION_HEADER} style={{ marginBottom: 0 }}>User</p>
          {users.length > 0 && (
            <select
              value={activeUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-yippie/30"
            >
              {users.map(u => (
                <option key={u.user_id} value={u.user_id}>{u.user_name}</option>
              ))}
            </select>
          )}
        </div>

        {usersLoading ? (
          <div className={CARD}>
            <Skeleton className="h-4 w-40 mb-5" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-16 mb-2" />
                  <Skeleton className="h-7 w-12" />
                </div>
              ))}
            </div>
          </div>
        ) : !selected ? (
          <div className={`${CARD} text-sm text-slate-400`}>No users to show</div>
        ) : (
          <div className="space-y-4">
            <div className={CARD}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-sm font-semibold text-slate-900">{selected.user_name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_STYLE[selected.role] ?? 'bg-slate-100 text-slate-500'}`}>
                  {selected.role}
                </span>
                <span className="text-xs text-slate-400">
                  {selected.last_login_at ? `active ${timeAgo(selected.last_login_at)}` : 'never signed in'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                <Stat label="First response" value={mins(selected.first_response_minutes)} sub="avg to first reply" />
                <Stat label="Avg resolution" value={hrs(selected.avg_resolution_hours)} />
                <Stat label="Open workload" value={num(selected.tickets_open)} sub="assigned now" />
                <Stat label="Tickets resolved" value={num(selected.tickets_resolved)} />
                <Stat label="Tickets created" value={num(selected.tickets_created)} />
                <Stat label="Emails sent" value={num(selected.emails_sent)} />
                <Stat label="Open rate" value={pct(selected.open_rate)} />
                <Stat label="Emails received" value={num(selected.emails_received_personal)} sub="personal mailbox" />
                <Stat label="Chats handled" value={num(selected.chats_handled)} />
                <Stat label="Chats solved" value={num(selected.chats_solved)} />
              </div>
            </div>

            {/* Timeline */}
            <div className={CARD}>
              <p className={SECTION_HEADER}>Recent activity</p>
              {eventsByDay.length === 0 ? (
                <p className="text-sm text-slate-400">No activity in this period</p>
              ) : (
                <div className="space-y-5">
                  {eventsByDay.map(([day, evs]) => (
                    <div key={day}>
                      <p className="text-xs font-semibold text-slate-400 mb-2">{day}</p>
                      <ul className="space-y-1.5">
                        {evs.map(ev => (
                          <li key={ev.id} className="flex items-center justify-between gap-4 text-sm">
                            <span className="text-slate-600 truncate">
                              <span className="text-slate-400 capitalize">{ev.module}</span>
                              {' · '}
                              {ev.event_type.replace(/[._]/g, ' ')}
                            </span>
                            <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                              {timeAgo(ev.created_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Department statistics */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className={SECTION_HEADER} style={{ marginBottom: 0 }}>Department statistics</p>
          {deptStats && (
            <span className="text-xs text-slate-400">
              Shared inbox: <span className="font-semibold text-slate-600">{deptStats.shared_emails_received}</span> received
            </span>
          )}
        </div>
        <div className={CARD}>
          {!deptStats || deptStats.departments.length === 0 ? (
            <p className="text-sm text-slate-400">No departments yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <th className="pb-3 font-semibold">Department</th>
                    <th className="pb-3 font-semibold text-right">Members</th>
                    <th className="pb-3 font-semibold text-right">Created</th>
                    <th className="pb-3 font-semibold text-right">Open</th>
                    <th className="pb-3 font-semibold text-right">Resolved</th>
                    <th className="pb-3 font-semibold text-right">Avg resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptStats.departments.map(d => (
                    <tr key={d.department_id}>
                      <td className="py-2.5 font-semibold text-slate-800">{d.department_name}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{d.member_count}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{d.tickets_created}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{d.tickets_open}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{d.tickets_resolved}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-600">{hrs(d.avg_resolution_hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
