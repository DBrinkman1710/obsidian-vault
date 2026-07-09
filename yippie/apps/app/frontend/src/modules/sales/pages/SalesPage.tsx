import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { Clock, Eye, Percent, Settings, ShoppingCart, TrendingUp } from 'lucide-react'
import { useAuth } from '../../../auth/useAuth'
import { SalesSettingsModal } from './SalesSettingsModal'

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

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function SalesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [showSettings, setShowSettings] = useState(false)

  const { data: stats, isError, isLoading } = useQuery<SalesStats>({
    queryKey: ['sales-summary'],
    queryFn: () => api.get('/sales/summary').then((r: any) => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track visitor behaviour on your clients' websites and surface it inside Yippie contact cards.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {stats?.last_event_at && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />
              Last event: {formatRelative(stats.last_event_at)}
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Settings"
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
          <p className="text-sm font-medium text-slate-500">Could not load sales data</p>
          <p className="text-xs mt-1">Check that the Sales Tracking module is enabled for your account.</p>
        </div>
      )}

      {/* Stats strip */}
      {!isError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total events',    value: isLoading ? '—' : (stats?.total_events ?? 0),                                                                                   Icon: TrendingUp,  color: 'text-yippie',      bg: 'bg-blue-50'    },
            { label: 'Page views',      value: isLoading ? '—' : (stats?.pageviews    ?? 0),                                                                                   Icon: Eye,         color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { label: 'Purchases',       value: isLoading ? '—' : (stats?.purchases    ?? 0),                                                                                   Icon: ShoppingCart,color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Conversion rate', value: isLoading ? '—' : (!stats || stats.pageviews === 0 ? '—' : `${((stats.purchases / stats.pageviews) * 100).toFixed(1)}%`),      Icon: Percent,     color: 'text-amber-600',   bg: 'bg-amber-50'   },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-semibold text-slate-900">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top pages */}
      {stats && stats.top_pages.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Top pages (all time)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-medium text-slate-500">Page</th>
                <th className="px-5 py-2 text-right text-xs font-medium text-slate-500">Views</th>
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
          <p className="text-sm font-medium">No events yet</p>
          <p className="text-xs mt-1">
            Click the <Settings className="inline w-3 h-3" /> settings icon above to get your
            installation snippet.
          </p>
        </div>
      )}

      {showSettings && <SalesSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
