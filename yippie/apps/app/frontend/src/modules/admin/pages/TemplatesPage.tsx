import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import EmailEditor, { EditorRef } from 'react-email-editor'
import { FileText, Loader2, MousePointerClick, Palette, Plus, Trash2, X } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { htmlToText } from '../../inbox/components/TemplatePicker'

interface Template {
  id: string
  name: string
  body: string
  design_json: string | null
  html_body: string | null
  campaign_buttons: string | null
  created_at: string
}

interface CampaignButton {
  id: string
  text: string
  action_type: 'label' | 'pipeline_stage'
  label_id: string | null
  stage_id: string | null
}

interface ContactLabel { id: string; name: string; color: string }
interface PipelineStage { id: string; name: string; color: string }

function newCampaignButton(id: string, text: string): CampaignButton {
  return { id, text, action_type: 'label', label_id: null, stage_id: null }
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

function extractButtonsFromDesign(design: object): Array<{ id: string; text: string }> {
  const found: Array<{ id: string; text: string }> = []
  function walk(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      const n = node as Record<string, unknown>
      if (n.type === 'button') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values = n.values as any
        const text = stripHtml(String(values?.text ?? ''))
        if (text) {
          found.push({ id: String(values?._meta?.htmlID ?? crypto.randomUUID()), text })
        }
      }
      Object.values(n).forEach(walk)
    }
  }
  walk(design)
  return found
}

function parseButtons(raw: string | null): CampaignButton[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(b => ({
      ...b,
      action_type: b.action_type ?? 'label',
      stage_id: b.stage_id ?? null,
    }))
  } catch {
    return []
  }
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const editorRef = useRef<EditorRef>(null)
  const pendingDesignRef = useRef<string | null | undefined>(undefined)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [name, setName] = useState('')
  const [existingBody, setExistingBody] = useState('')
  const [buttons, setButtons] = useState<CampaignButton[]>([])
  const [editorReady, setEditorReady] = useState(false)
  const [editorEverOpened, setEditorEverOpened] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/tickets/templates').then(r => r.data),
  })

  const { data: labels } = useQuery<ContactLabel[]>({
    queryKey: ['labels'],
    queryFn: () => api.get('/contacts/labels').then(r => r.data),
  })

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then(r => r.data),
  })

  const hasSelection = isNew || selectedId !== null

  const updateButton = (id: string, patch: Partial<CampaignButton>) =>
    setButtons(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))

  function syncButtonsFromDesign(design: object) {
    const detected = extractButtonsFromDesign(design)
    setButtons(prev => {
      const consumed = new Set<string | undefined>()
      return detected.map(d => {
        const existing = prev.find(b => b.text === d.text && !consumed.has(b.id))
        if (existing) consumed.add(existing.id)
        return existing
          ? { id: existing.id, text: d.text, action_type: existing.action_type, label_id: existing.label_id, stage_id: existing.stage_id }
          : newCampaignButton(d.id, d.text)
      })
    })
  }

  function loadIntoEditor(designJson: string | null) {
    const editor = editorRef.current?.editor
    if (!editor) {
      pendingDesignRef.current = designJson
      return
    }
    if (designJson) {
      try {
        editor.loadDesign(JSON.parse(designJson))
        return
      } catch {
        // fall through to blank canvas on corrupt design JSON
      }
    }
    editor.loadBlank()
  }

  function handleEditorReady() {
    setEditorReady(true)
    const editor = editorRef.current?.editor
    editor?.addEventListener('design:updated', () => {
      editor.exportHtml(({ design }) => {
        syncButtonsFromDesign(design)
      })
    })
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
    setButtons(parseButtons(t.campaign_buttons))
    setSaveError('')
    loadIntoEditor(t.design_json)
    if (t.design_json) {
      try {
        syncButtonsFromDesign(JSON.parse(t.design_json))
      } catch {
        // corrupt design JSON — design:updated will sync once the editor loads
      }
    }
  }

  function openNew() {
    setEditorEverOpened(true)
    setSelectedId(null)
    setIsNew(true)
    setName('')
    setExistingBody('')
    setButtons([])
    setSaveError('')
    loadIntoEditor(null)
    syncButtonsFromDesign({})
  }

  function clearSelection() {
    setSelectedId(null)
    setIsNew(false)
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tickets/templates/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      if (id === selectedId) clearSelection()
    },
  })

  function handleSave() {
    const editor = editorRef.current?.editor
    if (!editor || saving) return
    if (!name.trim()) { setSaveError('Template name is required'); return }
    setSaveError('')
    setSaving(true)
    editor.exportHtml(({ design, html }) => {
      const plain = htmlToText(html)
      const payload = {
        name: name.trim(),
        body: plain || existingBody,
        design_json: JSON.stringify(design),
        html_body: html,
        campaign_buttons: buttons,
      }
      if (isNew) createMutation.mutate(payload)
      else if (selectedId) updateMutation.mutate({ id: selectedId, payload })
    })
  }

  return (
    <>
      {/* Page — template list */}
      <div className="h-[calc(100vh-6rem)] min-h-[560px]">
        <aside className="w-[360px] h-full bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
            <h1 className="text-sm font-bold text-slate-900">Templates</h1>
            <button
              onClick={openNew}
              title="New template"
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="text-xs text-slate-400 px-4 py-4">Loading…</p>}

            {isNew && (
              <div className="px-4 py-3 bg-blue-50 border-l-2 border-blue-600">
                <p className="text-sm font-semibold text-blue-700 truncate">{name.trim() || 'New template'}</p>
                <p className="text-[11px] text-blue-400">Unsaved</p>
              </div>
            )}

            {!isLoading && templates?.length === 0 && !isNew && (
              <div className="text-center px-4 py-10">
                <FileText size={26} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No templates yet. Create one with the + button.</p>
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
      </div>

      {/* Full-screen editor modal — editor stays mounted once opened to avoid re-init */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
          hasSelection ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden shadow-2xl">
          {/* Modal header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
            <input
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Template name…"
            />
            {saveError && <p className="text-xs text-red-500 shrink-0">{saveError}</p>}
            <button
              onClick={handleSave}
              disabled={saving || !editorReady}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={clearSelection}
              className="shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close editor"
            >
              <X size={16} />
            </button>
          </div>

          {/* Editor + bottom panels */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="relative flex-1 min-h-0 mx-5 mt-5 border border-slate-200 rounded-t-xl overflow-hidden">
              {!editorReady && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50">
                  <Loader2 size={22} className="text-blue-500 animate-spin mb-2" />
                  <p className="text-xs text-slate-400">Loading email editor…</p>
                </div>
              )}
              {editorEverOpened && (
                <EmailEditor
                  ref={editorRef}
                  onReady={handleEditorReady}
                  minHeight="100%"
                  options={{
                    features: { textEditor: { spellChecker: true } },
                    appearance: {
                      theme: 'classic_light',
                      panels: { tools: { dock: 'left' } },
                    },
                    editor: { confirmOnDelete: false },
                  }}
                />
              )}
            </div>

            {/* Signature preview */}
            <div className="mx-5 shrink-0 border border-t-0 border-slate-200 rounded-b-xl bg-white px-4 py-3">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">— Signature</p>
              {user?.email_signature ? (
                <p className="text-xs text-slate-600 whitespace-pre-wrap">{user.email_signature}</p>
              ) : (
                <p className="text-xs text-slate-400 italic">No signature — add one in Profile settings.</p>
              )}
            </div>

            {/* Button label config — auto-detected from Unlayer button blocks */}
            <div className="mx-5 mb-5 mt-3 shrink-0 border border-slate-200 rounded-xl bg-white overflow-y-auto max-h-[200px]">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                <MousePointerClick size={13} className="text-blue-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Button Actions</span>
              </div>
              {buttons.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-slate-400">
                  Add a Button block to your email design to attach an action to it.
                </p>
              ) : (
                buttons.map(b => (
                  <div key={b.id} className="px-4 py-2.5 border-b last:border-0 border-slate-50 space-y-1.5">
                    <span className="inline-block max-w-full truncate px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-semibold" title={b.text}>
                      {b.text}
                    </span>
                    <div className="flex gap-2">
                      <select
                        className="w-32 shrink-0 px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        value={b.action_type}
                        onChange={e => updateButton(b.id, { action_type: e.target.value as 'label' | 'pipeline_stage', label_id: null, stage_id: null })}
                      >
                        <option value="label">Apply label</option>
                        <option value="pipeline_stage">Pipeline stage</option>
                      </select>
                      {b.action_type === 'label' ? (
                        <select
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                          value={b.label_id ?? ''}
                          onChange={e => updateButton(b.id, { label_id: e.target.value || null })}
                        >
                          <option value="">No label</option>
                          {labels?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      ) : (
                        <select
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                          value={b.stage_id ?? ''}
                          onChange={e => updateButton(b.id, { stage_id: e.target.value || null })}
                        >
                          <option value="">No stage</option>
                          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
