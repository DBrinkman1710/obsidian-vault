import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { Clock, Eye, Settings, ShoppingCart, TrendingUp } from 'lucide-react'
import { useAuth } from '../../../auth/useAuth'
import { SalesSettingsModal } from './SalesSettingsModal'

interface SalesStats {
  total_events: number
  pageviews: number
  purchases: number
  last_event_at: string | null
  top_pages: { url: string; count: number }[]
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
    <div className="max-w-4xl space-y-8">
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
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total events', value: isLoading ? '—' : (stats?.total_events ?? 0), Icon: TrendingUp },
            { label: 'Page views',   value: isLoading ? '—' : (stats?.pageviews     ?? 0), Icon: Eye },
            { label: 'Purchases',    value: isLoading ? '—' : (stats?.purchases     ?? 0), Icon: ShoppingCart },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Icon className="w-4 h-4 text-slate-600" />
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
                <th className="px-5 py-2 text-left text-xs font-medium text-slate-500">URL</th>
                <th className="px-5 py-2 text-right text-xs font-medium text-slate-500">Views</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.top_pages.map((p: any) => (
                <tr key={p.url} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-mono text-xs truncate max-w-xs">{p.url}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{p.count}</td>
                </tr>
              ))}
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
