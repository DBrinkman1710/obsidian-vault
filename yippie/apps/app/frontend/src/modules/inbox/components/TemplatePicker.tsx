import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { FileText, Loader2, Megaphone, Palette, Settings2, Sparkles, X } from 'lucide-react'
import { api } from '../../../api/client'
import { useTenantConfig } from '../../../App'

const TemplatesPageLazy = lazy(() => import('../../admin/pages/TemplatesPage'))

interface Template {
  id: string
  name: string
  body: string
  html_body: string | null
  campaign_buttons: string | null
  /** 'response' = standard ticket template; 'campaign' = from a marketing campaign */
  source?: 'response' | 'campaign'
  campaignName?: string
}

interface Campaign {
  id: string
  name: string
  subject: string
  status: string
}

interface CampaignTemplateRaw {
  id: string
  campaign_id: string
  raw_html: string | null
  campaign_buttons: string | null
  variant: string | null
}

interface Props {
  onSelect: (body: string, isHtml?: boolean, campaignButtons?: string | null) => void
  context?: string
  triggerClassName?: string
  triggerIconSize?: number
  direction?: 'up' | 'down'
}

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

export function TemplatePicker({ onSelect, context, triggerClassName, triggerIconSize, direction = 'up' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showManager, setShowManager] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const config = useTenantConfig()
  const marketingEnabled = config?.enabled_modules?.includes('marketing') ?? false

  const { data: responseTemplates = [] } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/tickets/templates').then(r => r.data),
    enabled: open,
  })

  // Fetch marketing campaigns when picker is open and marketing module is enabled.
  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['marketing-campaigns-picker'],
    queryFn: () => api.get('/marketing/campaigns').then(r => r.data),
    enabled: open && marketingEnabled,
  })

  // Fetch templates for each campaign in parallel.
  const campaignTemplateQueries = useQueries({
    queries: campaigns.map(c => ({
      queryKey: ['marketing-campaign-templates-picker', c.id],
      queryFn: () =>
        api.get<CampaignTemplateRaw[]>(`/marketing/campaigns/${c.id}/templates`).then(r => r.data),
      enabled: open && marketingEnabled && campaigns.length > 0,
    })),
  })

  // Flatten campaign template query results into usable Template objects.
  const campaignTemplates: Template[] = campaigns.flatMap((c, i) => {
    const result = campaignTemplateQueries[i]
    if (!result?.data) return []
    return result.data
      .filter(ct => ct.raw_html)
      .map(ct => ({
        id: `campaign-${ct.id}`,
        name: c.name,
        body: htmlToText(ct.raw_html!),
        html_body: ct.raw_html!,
        campaign_buttons: ct.campaign_buttons ?? null,
        source: 'campaign' as const,
        campaignName: c.name,
      }))
  })

  // All response templates tagged with source.
  const taggedResponseTemplates: Template[] = responseTemplates.map(t => ({ ...t, source: 'response' as const }))

  const allTemplates: Template[] = [...taggedResponseTemplates, ...campaignTemplates]

  const suggestMutation = useMutation({
    mutationFn: () => api.post('/tickets/templates/ai-suggest', { context: context ?? '' }).then(r => r.data),
  })

  const displayed: Template[] = suggestMutation.data
    ? (suggestMutation.data as Template[])
    : allTemplates.filter(t =>
        !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase())
      )

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleSelect(t: Template) {
    if (t.html_body) onSelect(t.html_body, true, t.campaign_buttons)
    else onSelect(t.body, false, null)
    setOpen(false)
    setSearch('')
    suggestMutation.reset()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={triggerClassName ?? 'px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5'}
      >
        <FileText size={triggerIconSize ?? 12} />
        Templates
      </button>

      {/* Full-screen template manager overlay */}
      {showManager && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-8 py-4">
            <h2 className="text-sm font-bold text-slate-900">Templates</h2>
            <button
              onClick={() => setShowManager(false)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-8">
            <Suspense fallback={
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={20} className="animate-spin text-blue-400" />
              </div>
            }>
              <TemplatesPageLazy />
            </Suspense>
          </div>
        </div>
      )}

      {open && (
        <div className={`absolute z-50 right-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden ${
          direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          <div className="px-3 pt-3 pb-2 border-b border-slate-100 flex items-center gap-2">
            <input
              autoFocus
              value={search}
              onChange={e => { setSearch(e.target.value); suggestMutation.reset() }}
              placeholder="Search templates…"
              className="flex-1 text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
            />
            {context !== undefined && (
              <button
                type="button"
                onClick={() => { setSearch(''); suggestMutation.mutate() }}
                disabled={suggestMutation.isPending}
                title="AI suggest relevant templates"
                className="shrink-0 px-2 py-1.5 bg-yippie text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1"
              >
                <Sparkles size={11} />
                {suggestMutation.isPending ? '…' : 'AI'}
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>

          {suggestMutation.data && (
            <div className="px-3 pt-2">
              <span className="text-[10px] font-bold tracking-widest text-violet-500 uppercase">AI Suggested</span>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            {displayed.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">
                {allTemplates.length === 0 ? 'No templates yet' : 'No matches'}
              </p>
            )}
            {displayed.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-sm font-semibold text-slate-800 truncate flex-1">{t.name}</p>
                  {t.source === 'campaign' && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold">
                      <Megaphone size={9} />
                      Campaign
                    </span>
                  )}
                </div>
                {t.html_body ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px] font-semibold">
                    <Palette size={9} />
                    Visual
                  </span>
                ) : (
                  <p className="text-xs text-slate-400 line-clamp-2">{t.body}</p>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); setShowManager(true) }}
            className="flex w-full items-center gap-1.5 px-3 py-2.5 border-t border-slate-100 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:bg-slate-50 transition-colors"
          >
            <Settings2 size={12} />
            Manage templates
          </button>
        </div>
      )}
    </div>
  )
}
