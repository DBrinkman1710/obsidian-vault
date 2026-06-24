import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import { AlertTriangle, BarChart3, Settings, Users, Zap } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { SaasSettingsModal } from './SaasSettingsModal'

interface HealthSummary {
  total_contacts_tracked: number
  onboarding_completion_pct: number
  top_features: { feature: string; count: number }[]
  common_errors: { error_code: string; count: number }[]
  at_risk_count: number
}

function HealthBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-500'
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

export default function SaasPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [showSettings, setShowSettings] = useState(false)

  const { data: summary } = useQuery<HealthSummary>({
    queryKey: ['saas-health-summary'],
    queryFn: () => api.get('/saas/health/summary').then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track feature adoption, onboarding completion, and health scores for SaaS clients.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors mt-1"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      {/* Stats strip */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Contacts tracked',      value: summary.total_contacts_tracked,       Icon: Users,          color: 'text-blue-600',  bg: 'bg-blue-50' },
            { label: 'Onboarding completion', value: `${summary.onboarding_completion_pct}%`, Icon: Zap,         color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'At-risk customers',     value: summary.at_risk_count,                Icon: AlertTriangle,  color: 'text-red-600',   bg: 'bg-red-50' },
          ].map(({ label, value, Icon, color, bg }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex items-center gap-3">
              <div className={`p-2 rounded-xl ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-semibold text-slate-900">{String(value)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Feature adoption */}
      {summary && summary.top_features.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Top features this month</h2>
          <div className="space-y-2">
            {summary.top_features.map((f: any, i: any) => {
              const max = summary.top_features[0]?.count || 1
              return (
                <div key={f.feature} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                  <span className="text-sm text-slate-700 w-36 truncate">{f.feature}</span>
                  <div className="flex-1">
                    <HealthBar pct={(f.count / max) * 100} />
                  </div>
                  <span className="text-xs text-slate-500 w-12 text-right">{f.count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Common errors */}
      {summary && summary.common_errors.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Most common errors (30 days)</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-medium text-slate-500">Error code</th>
                <th className="px-5 py-2 text-right text-xs font-medium text-slate-500">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.common_errors.map((e: any) => (
                <tr key={e.error_code} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 font-mono text-xs">{e.error_code}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{e.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {summary && summary.total_contacts_tracked === 0 && (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No product data yet</p>
          <p className="text-xs mt-1">
            Click the <Settings className="inline w-3 h-3" /> settings icon above to get your
            installation snippet.
          </p>
        </div>
      )}

      {showSettings && <SaasSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
