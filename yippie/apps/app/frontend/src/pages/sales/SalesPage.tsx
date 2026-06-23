import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { Copy, Check, TrendingUp, ShoppingCart, Eye, Clock } from 'lucide-react'

interface SalesStats {
  total_events: number
  pageviews: number
  purchases: number
  last_event_at: string | null
  top_pages: { url: string; count: number }[]
}

interface TrackingToken {
  tracking_token: string
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
  const [copied, setCopied] = useState(false)

  const { data: tokenData } = useQuery<TrackingToken>({
    queryKey: ['sales-token'],
    queryFn: () => api.get('/sales/token').then(r => r.data),
  })

  const { data: stats } = useQuery<SalesStats>({
    queryKey: ['sales-summary'],
    queryFn: () => api.get('/sales/summary').then(r => r.data),
    refetchInterval: 30_000,
  })

  const snippetScript = tokenData
    ? `<script src="https://getyippie.com/sales.js" data-token="${tokenData.tracking_token}" async></script>`
    : ''

  function copySnippet() {
    navigator.clipboard.writeText(snippetScript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track visitor behaviour on your clients' websites and surface it inside Yippie contact cards.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total events', value: stats?.total_events ?? '—', Icon: TrendingUp },
            { label: 'Page views', value: stats?.pageviews ?? '—', Icon: Eye },
            { label: 'Purchases', value: stats?.purchases ?? '—', Icon: ShoppingCart },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Icon className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-semibold text-slate-900">{value.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Snippet generator */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Installation snippet</h2>
            {stats?.last_event_at && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                Last event: {formatRelative(stats.last_event_at)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Paste this tag in the <code className="bg-slate-100 px-1 rounded">&lt;head&gt;</code> of your client's website.
            The snippet tracks page views automatically. Use <code className="bg-slate-100 px-1 rounded">yippie.track()</code> for custom events.
          </p>
          <div className="flex items-start gap-2">
            <pre className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {snippetScript || 'Loading…'}
            </pre>
            <button
              onClick={copySnippet}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-slate-900 text-white text-xs rounded-xl hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Then call <code className="bg-slate-100 px-1 rounded">yippie.identify('customer@example.com')</code> after login
            to link events to a Yippie contact.
          </p>
        </div>

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
                {stats.top_pages.map(p => (
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
        {stats && stats.total_events === 0 && (
          <div className="text-center py-16 text-slate-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No events yet</p>
            <p className="text-xs mt-1">Install the snippet on your client's site to start tracking.</p>
          </div>
        )}
    </div>
  )
}
