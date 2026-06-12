import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import EmailEditor, { EditorRef } from 'react-email-editor'
import { FileText, Loader2, MousePointerClick, Palette, Plus, Trash2 } from 'lucide-react'
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
  label_id: string | null
  multiple_allowed: boolean
  bg_color: string
  text_color: string
  border_radius: number
  font_size: number
  font_weight: string
  border_color: string | null
  border_width: number
}

interface ContactLabel { id: string; name: string; color: string }

function newCampaignButton(): CampaignButton {
  return {
    id: crypto.randomUUID(),
    text: 'Yes, count me in',
    label_id: null,
    multiple_allowed: false,
    bg_color: '#5BA4F5',
    text_color: '#ffffff',
    border_radius: 6,
    font_size: 14,
    font_weight: '600',
    border_color: null,
    border_width: 0,
  }
}

function parseButtons(raw: string | null): CampaignButton[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
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

  const hasSelection = isNew || selectedId !== null

  const updateButton = (id: string, patch: Partial<CampaignButton>) =>
    setButtons(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))

  const addButton = () => setButtons(prev => [...prev, newCampaignButton()])

  const removeButton = (id: string) => setButtons(prev => prev.filter(b => b.id !== id))

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
    if (pendingDesignRef.current !== undefined) {
      const pending = pendingDesignRef.current
      pendingDesignRef.current = undefined
      loadIntoEditor(pending)
    }
  }

  function openTemplate(t: Template) {
    setSelectedId(t.id)
    setIsNew(false)
    setName(t.name)
    setExistingBody(t.body)
    setButtons(parseButtons(t.campaign_buttons))
    setSaveError('')
    loadIntoEditor(t.design_json)
  }

  function openNew() {
    setSelectedId(null)
    setIsNew(true)
    setName('')
    setExistingBody('')
    setButtons([])
    setSaveError('')
    loadIntoEditor(null)
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
    <div className="flex gap-5 h-[calc(100vh-6rem)] min-h-[560px]">
      {/* Left panel — template list */}
      <aside className="w-[280px] shrink-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
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

      {/* Right panel — editor */}
      <section className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
        {!hasSelection ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <FileText size={36} className="text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-400">Select a template or create a new one</p>
            <p className="text-xs text-slate-400 mt-1">Design rich emails with drag-and-drop and add campaign buttons.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
              <input
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Template name…"
              />
              {saveError && <p className="text-xs text-red-500">{saveError}</p>}
              <button
                onClick={handleSave}
                disabled={saving || !editorReady}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="relative min-h-[500px] m-5 mb-0 border border-slate-200 rounded-t-xl overflow-hidden">
                {!editorReady && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50">
                    <Loader2 size={22} className="text-blue-500 animate-spin mb-2" />
                    <p className="text-xs text-slate-400">Loading email editor…</p>
                  </div>
                )}
                <EmailEditor
                  ref={editorRef}
                  onReady={handleEditorReady}
                  minHeight="100%"
                  options={{
                    features: { textEditor: { spellChecker: true } },
                    appearance: { theme: 'light', panels: { tools: { dock: 'left' } } },
                    editor: { confirmOnDelete: false },
                  }}
                />
              </div>

              {/* Signature preview — shown as email footer inside the content area */}
              <div className="mx-5 mb-5 shrink-0 border border-t-0 border-slate-200 rounded-b-xl bg-white px-4 py-3">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">— Signature</p>
                {user?.email_signature ? (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap">{user.email_signature}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No signature — add one in Profile settings.</p>
                )}
              </div>

              {/* Campaign button config — managed in React state, appended below the email body on send */}
              <div className="mx-5 mb-5 shrink-0 border border-slate-200 rounded-xl bg-white">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                  <MousePointerClick size={13} className="text-blue-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Campaign Buttons</span>
                  <button
                    onClick={addButton}
                    className="ml-auto inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[11px] font-semibold transition-colors"
                  >
                    <Plus size={11} strokeWidth={2.5} />
                    Add button
                  </button>
                </div>
                {buttons.length === 0 ? (
                  <p className="px-4 py-3 text-[11px] text-slate-400">
                    No campaign buttons. Add one to map a click to a contact label — it renders below the email body when sent.
                  </p>
                ) : (
                  buttons.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 border-slate-50">
                      <span className="text-xs text-slate-400 font-bold w-4 shrink-0">{i + 1}</span>
                      <input
                        className="w-32 px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        value={b.text}
                        placeholder="Button text"
                        onChange={e => updateButton(b.id, { text: e.target.value })}
                      />
                      <select
                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                        value={b.label_id ?? ''}
                        onChange={e => updateButton(b.id, { label_id: e.target.value || null })}
                      >
                        <option value="">No label</option>
                        {labels?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={b.multiple_allowed}
                          onChange={e => updateButton(b.id, { multiple_allowed: e.target.checked })}
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        <span className="text-[11px] text-slate-500">Multi</span>
                      </label>
                      <input type="color" value={b.bg_color} onChange={e => updateButton(b.id, { bg_color: e.target.value })} className="w-7 h-7 border-0 rounded cursor-pointer p-0" title="Background color" />
                      <input type="color" value={b.text_color} onChange={e => updateButton(b.id, { text_color: e.target.value })} className="w-7 h-7 border-0 rounded cursor-pointer p-0" title="Text color" />
                      <button
                        onClick={() => removeButton(b.id)}
                        className="shrink-0 p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
