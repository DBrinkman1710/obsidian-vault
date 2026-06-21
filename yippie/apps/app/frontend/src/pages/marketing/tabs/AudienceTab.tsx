import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { api } from '../../../api/client'
import { Campaign, FilterBy, marketingApi } from '../api'

interface Named { id: string; name: string }

const FILTER_OPTIONS: { key: FilterBy; label: string }[] = [
  { key: 'all', label: 'All contacts' },
  { key: 'label', label: 'By label' },
  { key: 'company', label: 'By company' },
  { key: 'pipeline_stage', label: 'By pipeline stage' },
]

export function AudienceTab({ campaign }: { campaign: Campaign }) {
  const qc = useQueryClient()
  const [filterBy, setFilterBy] = useState<FilterBy>(campaign.segment_filter?.filter_by ?? 'all')
  const [filterId, setFilterId] = useState<string | null>(campaign.segment_filter?.filter_id ?? null)
  const [minEngagement, setMinEngagement] = useState<number | null>(
    campaign.segment_filter?.min_engagement_score ?? null,
  )

  const { data: labels = [] } = useQuery<Named[]>({
    queryKey: ['contact-labels'],
    queryFn: () => api.get('/contacts/labels').then((r) => r.data),
  })
  const { data: companies = [] } = useQuery<Named[]>({
    queryKey: ['companies'],
    queryFn: () => api.get('/contacts/companies').then((r) => r.data),
  })
  const { data: stages = [] } = useQuery<Named[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r) => r.data),
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
      }),
    onSuccess: () => {
      toast.success('Audience saved')
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
    },
    onError: () => toast.error('Could not save audience'),
  })

  const needsPick = filterBy !== 'all'
  const canSave = filterBy === 'all' || !!filterId

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h3 className="text-sm font-semibold text-slate-900">Who receives this campaign?</h3>
        <p className="mt-1 text-xs text-slate-400">Choose a segment. The preview updates as you change it.</p>

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
              {filterBy === 'label' ? 'Label' : filterBy === 'company' ? 'Company' : 'Stage'}
            </label>
            <select
              value={filterId ?? ''}
              onChange={(e) => setFilterId(e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            >
              <option value="">Select…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {options.length === 0 && <p className="mt-1 text-xs text-slate-400">Nothing to pick here yet.</p>}
          </div>
        )}

        {/* Engagement score filter */}
        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Min engagement score (0–100)
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
            <span className="text-xs text-slate-400">Only contacts with score ≥ this value are included.</span>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 text-slate-700">
            <Users size={16} className="text-blue-600" />
            <span className="text-sm font-semibold">
              {isFetching ? 'Counting…' : `${preview?.count ?? 0} recipient${preview?.count === 1 ? '' : 's'}`}
            </span>
          </div>
          {preview && preview.names.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {preview.names.map((n, i) => (
                <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  {n}
                </span>
              ))}
              {preview.count > preview.names.length && (
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-400">
                  +{preview.count - preview.names.length} more
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={!canSave || save.isPending}
          className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {save.isPending ? 'Saving…' : 'Save audience'}
        </button>
      </div>
    </div>
  )
}
