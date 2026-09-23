import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock, Plus, Trash2, Save, X, LayoutTemplate, Pencil } from 'lucide-react'
import { api } from '../../../api/client'
import { Campaign, marketingApi, SequenceStep, SequenceStepInput } from '../api'
import { GrapesEditor, GrapesEditorHandle } from '../pages/GrapesEditor'
import type { PipelineStage } from '../pages/GrapesEditor'
import type { ContactLabel } from '../../../modules/contacts/components/LabelChip'
import { STARTER_TEMPLATES } from '../templates'
import { useT } from '../../../hooks/useT'

type PendingDesign = { type: 'design'; value: string } | { type: 'html'; value: string } | null

// Standard template a fresh drip step opens with, so users make small edits
// rather than start from a blank canvas. Body-only (no logo header/footer of its
// own) since the drip send already wraps it in the branded shell.
const DEFAULT_DRIP_TEMPLATE =
  STARTER_TEMPLATES.find((t) => t.id === 'reengage') ?? STARTER_TEMPLATES[0]

export function DripTab({ campaign }: { campaign: Campaign }) {
  const t = useT()
  const qc = useQueryClient()
  const editorRef = useRef<GrapesEditorHandle>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorEverOpened, setEditorEverOpened] = useState(false)
  const [showTemplates, setShowTemplates] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [delay, setDelay] = useState(3)
  const [subject, setSubject] = useState('')
  const pendingDesignRef = useRef<PendingDesign>(null)

  const { data: steps = [] } = useQuery({
    queryKey: ['marketing', 'sequences', campaign.id],
    queryFn: () => marketingApi.listSequences(campaign.id),
  })
  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
  })
  const { data: labels = [] } = useQuery<ContactLabel[]>({
    queryKey: ['contact-labels'],
    queryFn: () => api.get('/contacts/labels').then((r: any) => r.data),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['marketing', 'sequences', campaign.id] })
  }

  // Load whichever design was queued when the editor opened. Used both from
  // onReady (first mount) and when re-opening the already-mounted editor.
  function loadPending() {
    const p = pendingDesignRef.current
    if (!editorRef.current) return
    if (p?.type === 'design') editorRef.current.loadDesign(p.value)
    else if (p?.type === 'html') editorRef.current.loadDesign(JSON.stringify({ pages: [{ id: 'main', component: p.value }] }))
    else editorRef.current.loadDesign(null)
  }

  useEffect(() => {
    if (editorOpen) loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen])

  function openNew() {
    setEditingId(null)
    setDelay(3)
    setSubject('')
    pendingDesignRef.current = DEFAULT_DRIP_TEMPLATE
      ? { type: 'html', value: DEFAULT_DRIP_TEMPLATE.html }
      : null
    setEditorEverOpened(true)
    setEditorOpen(true)
  }

  function openEdit(step: SequenceStep) {
    setEditingId(step.id)
    setDelay(step.delay_days)
    setSubject(step.subject)
    pendingDesignRef.current = step.design_json
      ? { type: 'design', value: step.design_json }
      : step.html_body
      ? { type: 'html', value: step.html_body }
      : null
    setEditorEverOpened(true)
    setEditorOpen(true)
  }

  function loadStarter(html: string) {
    editorRef.current?.loadDesign(JSON.stringify({ pages: [{ id: 'main', component: html }] }))
    toast.message(t('mkt_template_loaded'))
  }

  const save = useMutation({
    mutationFn: () =>
      new Promise<void>((resolve, reject) => {
        if (!editorRef.current) { reject(new Error('editor not ready')); return }
        if (!subject.trim()) { reject(new Error('subject required')); return }
        editorRef.current.exportHtml(({ html, design, campaignButtons }) => {
          const body: SequenceStepInput = {
            delay_days: delay,
            subject: subject.trim(),
            html_body: html,
            design_json: JSON.stringify(design),
            campaign_buttons: campaignButtons,
          }
          const req = editingId
            ? marketingApi.updateSequence(campaign.id, editingId, body)
            : marketingApi.addSequence(campaign.id, body)
          req.then(() => resolve()).catch(reject)
        })
      }),
    onSuccess: () => {
      toast.success(t('mkt_step_added'))
      setEditorOpen(false)
      invalidate()
    },
    onError: (err: any) => {
      if (err?.message === 'subject required') { toast.error(t('mkt_subject_still')); return }
      toast.error(t('mkt_step_add_err'))
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => marketingApi.deleteSequence(campaign.id, id),
    onSuccess: () => {
      toast.success(t('mkt_step_removed'))
      invalidate()
    },
  })

  return (
    <>
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t('mkt_drip_heading')}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{t('mkt_drip_desc')}</p>
            </div>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 rounded-lg bg-yippie px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={14} /> {t('mkt_add_step')}
            </button>
          </div>

          <div className="mt-5 space-y-2">
            {steps.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                {t('mkt_no_steps')}
              </p>
            )}
            {steps.map((s: SequenceStep, i: number) => (
              <div
                key={s.id}
                onClick={() => openEdit(s)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-xs font-bold text-slate-600">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{s.subject}</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock size={12} />
                    <span>
                      {s.delay_days} {s.delay_days === 1 ? t('mkt_days_after_launch') : t('mkt_days_after_launch_pl')}
                    </span>
                    {s.sent_at && <span className="text-emerald-600">· {t('mkt_sent')}</span>}
                  </div>
                </div>
                <Pencil size={14} className="shrink-0 text-slate-300" />
                <button
                  onClick={(e) => { e.stopPropagation(); remove.mutate(s.id) }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-screen editor overlay */}
      <div
        className={`fixed inset-0 z-50 flex flex-col bg-white transition-opacity duration-200 ${
          editorOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Personalisation chips */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('mkt_personalisation')}</span>
          {(['{{first_name}}', '{{company}}', '{{email}}'] as const).map((token) => (
            <button
              key={token}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editorRef.current?.insertToken(token)}
              className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
            >
              {token}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-800">
              {editingId ? t('mkt_drip_heading') : t('mkt_add_step')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">{t('mkt_send_after_days')}</span>
              <input
                type="number"
                min={0}
                max={365}
                value={delay}
                onChange={(e) => setDelay(Math.max(0, Number(e.target.value)))}
                className="w-20 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">{t('mkt_subject_field')}</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('mkt_subject_still')}
                className="w-56 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates((s) => !s)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <LayoutTemplate size={14} /> {t('mkt_templates_btn')}
            </button>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !subject.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-yippie px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save size={14} /> {save.isPending ? t('mkt_saving') : t('mkt_save')}
            </button>
            <button
              onClick={() => setEditorOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title={t('mkt_close_editor')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Editor body */}
        <div className="flex min-h-0 flex-1">
          {showTemplates && (
            <div className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t('mkt_starter_templates')}</p>
              <div className="space-y-2">
                {STARTER_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => loadStarter(tpl.html)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"
                  >
                    <p className="text-sm font-semibold text-slate-800">{tpl.name}</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-400">{tpl.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1 bg-white">
            {editorEverOpened && (
              <GrapesEditor
                ref={editorRef}
                stages={stages}
                labels={labels}
                onReady={loadPending}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
