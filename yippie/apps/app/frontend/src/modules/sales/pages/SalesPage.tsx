import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { Clock, Settings, TrendingUp } from 'lucide-react'
import { useAuth } from '../../../auth/useAuth'
import { SalesSettingsModal } from './SalesSettingsModal'
import { Sparkline } from '../../../shell/Sparkline'
import { useT } from '../../../hooks/useT'

interface SalesStats {
  total_events: number
  pageviews: number
  purchases: number
  last_event_at: string | null
  top_pages: { url: string; count: number }[]
}

function cleanUrl(url: string): string {
  try { return new URL(url).pathname || '/' } catch { return url }
}

function useFormatRelative() {
  const t = useT()
  return (iso: string | null): string => {
    if (!iso) return t('sales_relative_never')
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('sales_relative_just_now')
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }
}

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

export default function SalesPage() {
  const t = useT()
  const formatRelative = useFormatRelative()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [showSettings, setShowSettings] = useState(false)
  const [period, setPeriod] = useState(30)

  const { data: stats, isError, isLoading } = useQuery<SalesStats>({
    queryKey: ['sales-summary'],
    queryFn: () => api.get('/sales/summary').then((r: any) => r.data),
    refetchInterval: 30_000,
  })

  const { data: sparklines } = useQuery<{ pageviews: number[]; purchases: number[] }>({
    queryKey: ['sales-sparklines', period],
    queryFn: () => api.get('/sales/sparklines', { params: { days: period } }).then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="heading-xl text-slate-900">{t('sales_title')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('sales_subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {stats?.last_event_at && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              {t('sales_last_event')} {formatRelative(stats.last_event_at)}
            </span>
          )}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
            {PERIOD_OPTIONS.map(o => (
              <button
                key={o.days}
                onClick={() => setPeriod(o.days)}
                className={`px-2.5 py-1 rounded-md transition-all ${period === o.days ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title={t('sales_settings_title')}
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="text-center py-16 text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-slate-500">{t('sales_error_title')}</p>
          <p className="text-xs mt-1">{t('sales_error_subtitle')}</p>
        </div>
      )}

      {/* Stats strip */}
      {!isError && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: t('sales_stat_pageviews'),  value: isLoading ? '—' : (stats?.pageviews  ?? 0), sparkData: sparklines?.pageviews,  color: '#5BA4F5' },
            { label: t('sales_stat_purchases'),  value: isLoading ? '—' : (stats?.purchases  ?? 0), sparkData: sparklines?.purchases,  color: '#22c55e' },
            { label: t('sales_stat_conversion'), value: isLoading ? '—' : (!stats || stats.pageviews === 0 ? '—' : `${((stats.purchases / stats.pageviews) * 100).toFixed(1)}%`), sparkData: undefined, color: '#f59e0b' },
          ].map(({ label, value, sparkData, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold text-slate-900">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
              </div>
              {sparkData && <Sparkline data={sparkData} color={color} />}
            </div>
          ))}
        </div>
      )}

      {/* Top pages */}
      {stats && stats.top_pages.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">{t('sales_top_pages_heading')}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-medium text-slate-500">{t('sales_col_page')}</th>
                <th className="px-5 py-2 text-right text-xs font-medium text-slate-500">{t('sales_col_views')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.top_pages.map((p: any) => {
                const maxViews = stats.top_pages[0]?.count || 1
                const pct = Math.round((p.count / maxViews) * 100)
                const path = cleanUrl(p.url)
                return (
                  <tr key={p.url} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 max-w-xs">
                      <div className="text-slate-700 font-mono text-xs truncate mb-1" title={p.url}>{path}</div>
                      <div className="w-full bg-slate-100 rounded-full h-1">
                        <div className="h-1 rounded-full bg-yippie" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-600 font-medium tabular-nums">{p.count.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && stats && stats.total_events === 0 && (
        <div className="text-center py-16 text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{t('sales_empty_title')}</p>
          <p className="text-xs mt-1">
            {t('sales_empty_subtitle')}
          </p>
        </div>
      )}

      {showSettings && <SalesSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
