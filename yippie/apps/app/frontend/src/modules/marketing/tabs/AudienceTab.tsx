import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { api } from '../../../api/client'
import { Campaign, FilterBy, marketingApi } from '../api'
import { useT } from '../../../hooks/useT'

interface Named { id: string; name: string }

export function AudienceTab({ campaign }: { campaign: Campaign }) {
  const t = useT()
  const qc = useQueryClient()
  const [filterBy, setFilterBy] = useState<FilterBy>(campaign.segment_filter?.filter_by ?? 'all')
  const [filterId, setFilterId] = useState<string | null>(campaign.segment_filter?.filter_id ?? null)
  const [minEngagement, setMinEngagement] = useState<number | null>(
    campaign.segment_filter?.min_engagement_score ?? null,
  )

  const FILTER_OPTIONS: { key: FilterBy; label: string }[] = [
    { key: 'all',           label: t('mkt_filter_all_contacts') },
    { key: 'label',         label: t('mkt_filter_by_label') },
    { key: 'company',       label: t('mkt_filter_by_company') },
    { key: 'pipeline_stage', label: t('mkt_filter_by_stage') },
  ]

  const { data: labels = [] } = useQuery<Named[]>({
    queryKey: ['contact-labels'],
    queryFn: () => api.get('/contacts/labels').then((r: any) => r.data),
  })
  const { data: companies = [] } = useQuery<Named[]>({
    queryKey: ['companies'],
    queryFn: () => api.get('/contacts/companies').then((r: any) => r.data),
  })
  const { data: stages = [] } = useQuery<Named[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
  })

  const options: Named[] = useMemo(() => {
    if (filterBy === 'label') return labels
    if (filterBy === 'company') return companies
    if (filterBy === 'pipeline_stage') return stages
    return []
  }, [filterBy, labels, companies, stages])

  // Reset the picked id when the filter type changes to something incompatible.
  useEffect(() => {
    if (filterBy === 'all') setFilterId(null)
  }, [filterBy])

  const { data: preview, isFetching } = useQuery({
    queryKey: ['marketing', 'segment-preview', filterBy, filterId],
    queryFn: () => marketingApi.previewSegment(filterBy, filterBy === 'all' ? null : filterId),
    enabled: filterBy === 'all' || !!filterId,
  })

  const save = useMutation({
    mutationFn: () =>
      marketingApi.updateCampaign(campaign.id, {
        segment_filter: {
          filter_by: filterBy,
          filter_id: filterBy === 'all' ? null : filterId,
          min_engagement_score: minEngagement,
        },
      } as any),
    onSuccess: () => {
      toast.success(t('mkt_audience_saved'))
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
    },
    onError: () => toast.error(t('mkt_audience_save_err')),
  })

  const needsPick = filterBy !== 'all'
  const canSave = filterBy === 'all' || !!filterId

  const pickLabel =
    filterBy === 'label'
      ? t('mkt_pick_label')
      : filterBy === 'company'
      ? t('mkt_pick_company')
      : t('mkt_pick_stage')

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h3 className="text-sm font-semibold text-slate-900">{t('mkt_audience_heading')}</h3>
        <p className="mt-1 text-xs text-slate-400">{t('mkt_audience_desc')}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {FILTER_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setFilterBy(o.key)}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                filterBy === o.key ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {needsPick && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {pickLabel}
            </label>
            <select
              value={filterId ?? ''}
              onChange={(e) => setFilterId(e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">{t('mkt_select_ph')}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {options.length === 0 && <p className="mt-1 text-xs text-slate-400">{t('mkt_nothing_to_pick')}</p>}
          </div>
        )}

        {/* Engagement score filter */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t('mkt_min_engagement')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Any"
              value={minEngagement ?? ''}
              onChange={(e) => setMinEngagement(e.target.value === '' ? null : Number(e.target.value))}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
            <span className="text-xs text-slate-400">{t('mkt_engagement_desc')}</span>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-700">
            <Users size={16} className="text-blue-600" />
            <span className="text-sm font-semibold">
              {isFetching
                ? t('mkt_counting')
                : `${preview?.count ?? 0} ${preview?.count === 1 ? t('mkt_recipient') : t('mkt_recipients')}`}
            </span>
          </div>
          {preview && preview.names.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {preview.names.map((n: any, i: any) => (
                <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {n}
                </span>
              ))}
              {preview.count > preview.names.length && (
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-400">
                  +{preview.count - preview.names.length} {t('mkt_more')}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={!canSave || save.isPending}
          className="mt-5 rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {save.isPending ? t('mkt_saving_audience') : t('mkt_save_audience')}
        </button>
      </div>
    </div>
  )
}
