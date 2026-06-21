import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Campaign, marketingApi } from './api'
import { StatusBadge } from './MarketingPage'
import { DesignTab } from './tabs/DesignTab'
import { AudienceTab } from './tabs/AudienceTab'
import { ScheduleTab } from './tabs/ScheduleTab'
import { AnalyticsTab } from './tabs/AnalyticsTab'
import { DripTab } from './tabs/DripTab'

type TabKey = 'design' | 'audience' | 'schedule' | 'analytics' | 'drip'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'design', label: 'Design' },
  { key: 'audience', label: 'Audience' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'drip', label: 'Drip sequences' },
]

export function CampaignDetail({ campaign, onDeleted }: { campaign: Campaign; onDeleted: () => void }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('design')

  const del = useMutation({
    mutationFn: () => marketingApi.deleteCampaign(campaign.id),
    onSuccess: () => {
      toast.success('Campaign deleted')
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
      onDeleted()
    },
    onError: () => toast.error('Only draft campaigns can be deleted.'),
  })

  const analyticsReady = campaign.status === 'sending' || campaign.status === 'completed'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 pt-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">{campaign.name}</h2>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="mt-1 truncate font-mono text-xs text-slate-400">{campaign.subject}</p>
          </div>
          {campaign.status === 'draft' && (
            <button
              onClick={() => {
                if (confirm('Delete this draft campaign?')) del.mutate()
              }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>

        {/* Tabs */}
        <nav className="mt-4 flex gap-1">
          {TABS.map((t) => {
            const disabled = t.key === 'analytics' && !analyticsReady
            return (
              <button
                key={t.key}
                disabled={disabled}
                onClick={() => setTab(t.key)}
                className={`relative px-3 pb-2.5 text-sm font-medium transition-colors ${
                  disabled
                    ? 'cursor-not-allowed text-slate-300'
                    : tab === t.key
                      ? 'text-blue-600'
                      : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
                {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600" />}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Tab body */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === 'design' && <DesignTab campaign={campaign} />}
        {tab === 'audience' && <AudienceTab campaign={campaign} />}
        {tab === 'schedule' && <ScheduleTab campaign={campaign} />}
        {tab === 'analytics' && analyticsReady && <AnalyticsTab campaign={campaign} />}
        {tab === 'drip' && <DripTab campaign={campaign} />}
      </div>
    </div>
  )
}
