import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LayoutTemplate, Save, X, Pencil } from 'lucide-react'
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
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorEverOpened, setEditorEverOpened] = useState(false)

  // Refs so onReady callback always sees current values without stale closures
  const templatesRef = useRef<typeof templates>([])
  const activeVariantRef = useRef(activeVariant)
  activeVariantRef.current = activeVariant

  const { data: templates = [] } = useQuery({
    queryKey: ['marketing', 'templates', campaign.id],
    queryFn: () => marketingApi.getTemplates(campaign.id),
  })
  templatesRef.current = templates

  useEffect(() => {
    const hasB = templates.some((t) => t.variant === 'b')
    if (hasB) {
      setAbEnabled(true)
      setActiveVariant((v) => (v === 'single' ? 'a' : v))
    }
  }, [templates])

  // Reload canvas when variant switches or templates refresh (editor already mounted)
  useEffect(() => {
    const wantVariant: Variant | null = activeVariant === 'single' ? null : activeVariant
    const tpl = templates.find((t) => t.variant === wantVariant)
    if (editorRef.current) {
      editorRef.current.setContent(tpl?.raw_html || '', tpl?.raw_css || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariant, templates.length])

  // Called by GrapesEditor once GrapesJS is initialised — loads design saved for current variant
  function handleEditorReady() {
    const wantVariant: Variant | null = activeVariantRef.current === 'single' ? null : activeVariantRef.current
    const tpl = templatesRef.current.find((t) => t.variant === wantVariant)
    editorRef.current?.setContent(tpl?.raw_html || '', tpl?.raw_css || '')
  }

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

  function openEditor() {
    setEditorEverOpened(true)
    setEditorOpen(true)
  }

  const hasDesign = templates.some((t) => t.raw_html)

  return (
    <>
      {/* Collapsed view shown inside the campaign Design tab */}
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-50">
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {hasDesign ? 'Email design saved' : 'No design yet'}
          </p>
          <p className="text-xs text-slate-400">
            {hasDesign ? 'Click below to edit your email' : 'Start designing your campaign email'}
          </p>
        </div>
        <button
          onClick={openEditor}
          className="flex items-center gap-2 rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Pencil size={14} />
          {hasDesign ? 'Edit design' : 'Open editor'}
        </button>
      </div>

      {/* Full-screen editor overlay — stays mounted after first open to preserve GrapesJS state */}
      <div
        className={`fixed inset-0 z-50 flex flex-col bg-white transition-opacity duration-200 ${
          editorOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Personalization chips */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-2">
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
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="max-w-[200px] truncate text-sm font-semibold text-slate-800">{campaign.name}</span>
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
              className="flex items-center gap-1.5 rounded-lg bg-yippie px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save size={14} /> {save.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditorOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close editor"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex min-h-0 flex-1">
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
          <div className="min-w-0 flex-1 bg-white">
            {editorEverOpened && <GrapesEditor ref={editorRef} onReady={handleEditorReady} />}
          </div>
        </div>
      </div>
    </>
  )
}
