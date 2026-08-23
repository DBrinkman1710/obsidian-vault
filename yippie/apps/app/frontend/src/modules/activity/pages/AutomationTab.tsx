import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { api } from '../../../api/client'
import { timeAgo } from '../../../lib/format'
import { useT } from '../../../hooks/useT'
import { Skeleton } from '../../../shell/Skeleton'

const CARD = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6'
const SECTION_HEADER = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4'

interface FlowStat {
  flow_id: string
  name: string
  enabled: boolean
  trigger_type: string
  fires: number
  success: number
  partial: number
  failed: number
  skipped: number
  success_rate: number | null
  est_hours_saved: number
  last_error: string | null
  last_run_at: string | null
}
interface FlowPerf {
  period_days: number
  totals: {
    fires: number
    success: number
    partial: number
    failed: number
    skipped: number
    success_rate: number | null
    est_hours_saved: number
  }
  flows: FlowStat[]
}

const PERIODS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const

type Tone = 'good' | 'warn' | 'bad' | 'none'
const toneText = (t: Tone): string =>
  t === 'good' ? 'text-success-600' : t === 'warn' ? 'text-warning-600' : t === 'bad' ? 'text-danger-600' : 'text-slate-900'
const rateTone = (r: number | null): Tone => r === null ? 'none' : r >= 0.9 ? 'good' : r >= 0.75 ? 'warn' : 'bad'

function pct(v: number | null): string {
  return v === null ? '—' : `${Math.round(v * 1000) / 10}%`
}

function Hero({ label, value, sub, tone = 'none' }: { label: string; value: string; sub?: string; tone?: Tone }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-extrabold tabular-nums ${toneText(tone)}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

/** Proportional success / partial / failed bar for a flow row. */
function StatusBar({ f }: { f: FlowStat }) {
  const total = f.success + f.partial + f.failed
  if (total === 0) return <div className="h-2 rounded-full bg-slate-100" />
  const seg = (n: number, color: string) =>
    n > 0 ? <div style={{ width: `${(n / total) * 100}%`, background: color }} /> : null
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {seg(f.success, '#22c55e')}
      {seg(f.partial, '#f59e0b')}
      {seg(f.failed, '#ef4444')}
    </div>
  )
}

export default function AutomationTab() {
  const t = useT()
  const [days, setDays] = useState<number>(7)

  const { data, isLoading } = useQuery<FlowPerf>({
    queryKey: ['flow-performance', days],
    queryFn: () => api.get('/flows/performance', { params: { days } }).then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  const totals = data?.totals
  const flows = data?.flows ?? []

  return (
    <div className="space-y-8">
      {/* Period toggle */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          {t('activity_automation_intro').replace('{days}', String(days))}
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

      {/* Flows performance */}
      <section>
        <p className={SECTION_HEADER}>{t('activity_flows_heading')}</p>

        {/* Totals */}
        <div className={`${CARD} mb-4`}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <Hero label={t('activity_fires_label')} value={isLoading ? '—' : String(totals?.fires ?? 0)} sub={t('activity_fires_sub')} />
            <Hero label={t('activity_success_rate_label')} value={isLoading ? '—' : pct(totals?.success_rate ?? null)} tone={rateTone(totals?.success_rate ?? null)} />
            <Hero label={t('activity_hours_saved_label')} value={isLoading ? '—' : `${totals?.est_hours_saved ?? 0}h`} sub={t('activity_hours_saved_sub')} />
            <Hero label={t('activity_failed_label')} value={isLoading ? '—' : String(totals?.failed ?? 0)} tone={(totals?.failed ?? 0) > 0 ? 'bad' : 'none'} />
          </div>
        </div>

        {/* Per flow table */}
        <div className={CARD}>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : flows.length === 0 ? (
            <p className="text-sm text-slate-400">{t('activity_no_flows')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    <th className="pb-3 font-semibold">{t('activity_col_flow')}</th>
                    <th className="pb-3 font-semibold w-40">{t('activity_col_health')}</th>
                    <th className="pb-3 font-semibold text-right">{t('activity_col_fires')}</th>
                    <th className="pb-3 font-semibold text-right">{t('activity_col_success')}</th>
                    <th className="pb-3 font-semibold text-right">{t('activity_col_skipped')}</th>
                    <th className="pb-3 font-semibold text-right">{t('activity_col_saved')}</th>
                    <th className="pb-3 font-semibold text-right">{t('activity_col_last_run')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {flows.map(f => (
                    <tr key={f.flow_id} className={f.enabled ? '' : 'opacity-50'}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 truncate">{f.name}</span>
                          {!f.enabled && <span className="text-xs text-slate-400">{t('activity_flow_off')}</span>}
                          {f.last_error && (
                            <AlertTriangle size={12} className="text-danger-500 shrink-0" aria-label={f.last_error} />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{f.trigger_type.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="py-2.5 pr-4"><StatusBar f={f} /></td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{f.fires}</td>
                      <td className={`py-2.5 text-right tabular-nums font-semibold ${toneText(rateTone(f.success_rate))}`}>{pct(f.success_rate)}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-500">{f.skipped}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-700">{f.est_hours_saved}h</td>
                      <td className="py-2.5 text-right text-xs text-slate-400 tabular-nums">{f.last_run_at ? timeAgo(f.last_run_at) : '—'}</td>
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
