import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LayoutTemplate, Save } from 'lucide-react'
import { Campaign, marketingApi, Variant } from '../api'
import { GrapesEditor, GrapesEditorHandle } from '../GrapesEditor'
import { STARTER_TEMPLATES } from '../templates'

type VariantKey = 'single' | 'a' | 'b'

export function DesignTab({ campaign }: { campaign: Campaign }) {
  const qc = useQueryClient()
  const editorRef = useRef<GrapesEditorHandle>(null)
  const [abEnabled, setAbEnabled] = useState(false)
  const [activeVariant, setActiveVariant] = useState<VariantKey>('single')
  const [showTemplates, setShowTemplates] = useState(true)

  const { data: templates = [] } = useQuery({
    queryKey: ['marketing', 'templates', campaign.id],
    queryFn: () => marketingApi.getTemplates(campaign.id),
  })

  // Decide A/B mode from what's already saved.
  useEffect(() => {
    const hasB = templates.some((t) => t.variant === 'b')
    if (hasB) {
      setAbEnabled(true)
      setActiveVariant((v) => (v === 'single' ? 'a' : v))
    }
  }, [templates])

  // Load the active variant's content into the canvas when it changes.
  useEffect(() => {
    const wantVariant: Variant | null = activeVariant === 'single' ? null : activeVariant
    const tpl = templates.find((t) => t.variant === wantVariant)
    if (editorRef.current) {
      editorRef.current.setContent(tpl?.raw_html || '', tpl?.raw_css || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariant, templates.length])

  const save = useMutation({
    mutationFn: () => {
      const html = editorRef.current?.getHtml() ?? ''
      const css = editorRef.current?.getCss() ?? ''
      const variant: Variant | null = activeVariant === 'single' ? null : activeVariant
      return marketingApi.setTemplates(campaign.id, [{ variant, raw_html: html, raw_css: css }])
    },
    onSuccess: () => {
      toast.success('Design saved')
      qc.invalidateQueries({ queryKey: ['marketing', 'templates', campaign.id] })
    },
    onError: () => toast.error('Could not save design'),
  })

  function toggleAb() {
    const next = !abEnabled
    setAbEnabled(next)
    setActiveVariant(next ? 'a' : 'single')
  }

  function loadStarter(html: string) {
    editorRef.current?.setContent(html, '')
    toast.message('Template loaded — edit and save when ready.')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Personalization chips */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Personalisation</span>
        {(['{{first_name}}', '{{company}}', '{{email}}'] as const).map((token) => (
          <button
            key={token}
            onClick={() => {
              const html = editorRef.current?.getHtml() ?? ''
              editorRef.current?.setContent(html + token, editorRef.current?.getCss() ?? '')
            }}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            {token}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={abEnabled} onChange={toggleAb} className="h-4 w-4 rounded border-slate-300" />
            A/B testing
          </label>
          {abEnabled && (
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {(['a', 'b'] as Variant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setActiveVariant(v)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase transition-colors ${
                    activeVariant === v ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Variant {v}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <LayoutTemplate size={14} /> Templates
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} /> {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Starter templates */}
        {showTemplates && (
          <div className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Starter templates</p>
            <div className="space-y-2">
              {STARTER_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadStarter(t.html)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                  <p className="mt-0.5 text-xs leading-snug text-slate-400">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="min-w-0 flex-1 bg-white">
          <GrapesEditor ref={editorRef} />
        </div>
      </div>
    </div>
  )
}
