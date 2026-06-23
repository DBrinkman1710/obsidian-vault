import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import GrapesEditor, { GrapesEditorHandle, type PipelineStage, type CampaignButton } from '../components/GrapesEditor'
import { Copy, FileText, Loader2, Palette, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { api } from '../../../api/client'
import { fetchLabels, type ContactLabel } from '../../contacts/components/LabelChip'
import { htmlToText } from '../../inbox/components/TemplatePicker'
import { STARTER_TEMPLATES } from '../../../pages/marketing/templates'

interface Template {
  id: string
  name: string
  body: string
  design_json: string | null
  html_body: string | null
  campaign_buttons: string | null
  created_at: string
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const editorRef = useRef<GrapesEditorHandle>(null)
  const pendingDesignRef = useRef<string | null | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [name, setName] = useState('')
  const [existingBody, setExistingBody] = useState('')
  const [editorReady, setEditorReady] = useState(false)
  const [editorEverOpened, setEditorEverOpened] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/tickets/templates').then(r => r.data),
  })

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then(r => r.data),
  })

  const { data: labels = [] } = useQuery<ContactLabel[]>({
    queryKey: ['contact-labels'],
    queryFn: fetchLabels,
  })

  const hasSelection = isNew || selectedId !== null

  function loadIntoEditor(designJson: string | null) {
    const editor = editorRef.current
    if (!editor) {
      pendingDesignRef.current = designJson
      return
    }
    editor.loadDesign(designJson)
  }

  function handleEditorReady() {
    setEditorReady(true)
    if (pendingDesignRef.current !== undefined) {
      const pending = pendingDesignRef.current
      pendingDesignRef.current = undefined
      loadIntoEditor(pending)
    }
  }

  function openTemplate(t: Template) {
    setEditorEverOpened(true)
    setSelectedId(t.id)
    setIsNew(false)
    setName(t.name)
    setExistingBody(t.body)
    setSaveError('')
    loadIntoEditor(t.design_json)
  }

  function openNew() {
    setEditorEverOpened(true)
    setSelectedId(null)
    setIsNew(true)
    setName('')
    setExistingBody('')
    setSaveError('')
    loadIntoEditor(null)
  }

  function clearSelection() {
    setSelectedId(null)
    setIsNew(false)
  }

  function openStarter(html: string) {
    setEditorEverOpened(true)
    setSelectedId(null)
    setIsNew(true)
    setName('')
    setExistingBody('')
    setSaveError('')
    // Load HTML directly into GrapesJS project data format
    loadIntoEditor(JSON.stringify({ pages: [{ component: html }] }))
  }

  const createMutation = useMutation({
    mutationFn: (payload: object) => api.post('/tickets/templates', payload).then(r => r.data as Template),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setIsNew(false)
      setSelectedId(created.id)
      setSaving(false)
    },
    onError: () => { setSaving(false); setSaveError('Save failed — please try again') },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: object }) =>
      api.patch(`/tickets/templates/${id}`, payload).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setSaving(false)
    },
    onError: () => { setSaving(false); setSaveError('Save failed — please try again') },
  })

  const ctx = useContextMenu()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tickets/templates/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      if (id === selectedId) clearSelection()
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: (t: Template) => api.post('/tickets/templates', {
      name: `${t.name} (copy)`,
      body: t.body ?? '',
      design_json: t.design_json ?? null,
      html_body: t.html_body ?? null,
      campaign_buttons: t.campaign_buttons ?? null,
    }).then(r => r.data as Template),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      openTemplate(created)
    },
  })

  function handleSave() {
    const editor = editorRef.current
    if (!editor || saving) return
    if (!name.trim()) { setSaveError('Template name is required'); return }
    setSaveError('')
    setSaving(true)
    editor.exportHtml(({ design, html, campaignButtons }: { design: object; html: string; campaignButtons: CampaignButton[] }) => {
      const plain = htmlToText(html)
      const payload = {
        name: name.trim(),
        body: plain || existingBody,
        design_json: JSON.stringify(design),
        html_body: html,
        campaign_buttons: campaignButtons,
      }
      if (isNew) createMutation.mutate(payload)
      else if (selectedId) updateMutation.mutate({ id: selectedId, payload })
    })
  }

  return (
    <div className="flex h-full gap-5">
      {/* Left: template list */}
      <aside className="w-72 shrink-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <h1 className="text-sm font-bold text-slate-900">Templates</h1>
          <button
            onClick={openNew}
            title="New template"
            className="p-1.5 bg-yippie hover:opacity-90 text-white rounded-lg transition-opacity"
          >
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="text-xs text-slate-400 px-4 py-4">Loading…</p>}

          {/* Starter templates */}
          <div className="px-3 pt-3 pb-1">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Starter templates</p>
            <div className="space-y-1.5">
              {STARTER_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openStarter(t.html)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/50"
                >
                  <p className="text-xs font-semibold text-slate-800">{t.name}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Divider + user templates header */}
          <div className="mt-3 border-t border-slate-100 px-3 pt-3 pb-1">
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">My templates</p>
          </div>

          {isNew && (
            <div className="px-4 py-3 bg-blue-50 border-l-2 border-blue-600">
              <p className="text-sm font-semibold text-blue-700 truncate">{name.trim() || 'New template'}</p>
              <p className="text-[11px] text-blue-400">Unsaved</p>
            </div>
          )}

          {!isLoading && templates?.length === 0 && !isNew && (
            <div className="text-center px-4 py-6">
              <FileText size={22} className="text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No templates yet. Pick a starter above or use the + button.</p>
            </div>
          )}

          {templates?.map(t => (
            <div
              key={t.id}
              className={`group flex items-center gap-2 px-4 py-3 border-l-2 cursor-pointer transition-colors ${
                t.id === selectedId
                  ? 'bg-blue-50 border-blue-600'
                  : 'border-transparent hover:bg-slate-50'
              }`}
              onClick={() => openTemplate(t)}
              onContextMenu={e => ctx.open(e, [
                { label: 'Edit', icon: <Pencil size={13} />, onClick: () => openTemplate(t) },
                { label: 'Duplicate', icon: <Copy size={13} />, onClick: () => duplicateMutation.mutate(t) },
                { separator: true },
                { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: () => { if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id) } },
              ])}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${t.id === selectedId ? 'text-blue-700' : 'text-slate-800'}`}>
                  {t.name}
                </p>
                {t.html_body && (
                  <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded text-[10px] font-semibold">
                    <Palette size={9} />
                    Rich design
                  </span>
                )}
              </div>
              <button
                onClick={e => {
                  e.stopPropagation()
                  if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id)
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                title="Delete template"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Right: editor panel — always in DOM once opened so GrapesJS stays mounted */}
      <div className="flex-1 min-w-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 shrink-0">
          <input
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Template name…"
          />
          {saveError && <p className="text-xs text-red-500 shrink-0">{saveError}</p>}
          <button
            onClick={handleSave}
            disabled={saving || !editorReady || !hasSelection}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save'}
          </button>
          <button
            onClick={clearSelection}
            className="shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Deselect template"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative flex-1 min-h-0 overflow-hidden">
          {!editorReady && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50">
              <Loader2 size={22} className="text-blue-500 animate-spin mb-2" />
              <p className="text-xs text-slate-400">Loading email editor…</p>
            </div>
          )}
          {editorEverOpened && (
            <GrapesEditor
              ref={editorRef}
              stages={stages}
              labels={labels}
              onReady={handleEditorReady}
            />
          )}
        </div>
      </div>

      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </div>
  )
}
