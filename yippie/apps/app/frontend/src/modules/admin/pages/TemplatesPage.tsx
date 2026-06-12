import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import EmailEditor, { EditorRef } from 'react-email-editor'
import { FileText, GripVertical, Loader2, MousePointerClick, Palette, Plus, Trash2 } from 'lucide-react'
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

type EditorTab = 'design' | 'buttons'

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

function buttonStyle(b: CampaignButton): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '10px 22px',
    margin: '6px 8px 6px 0',
    background: b.bg_color,
    color: b.text_color,
    borderRadius: `${b.border_radius}px`,
    fontSize: `${b.font_size}px`,
    fontWeight: b.font_weight,
    textDecoration: 'none',
    border: b.border_width > 0 && b.border_color ? `${b.border_width}px solid ${b.border_color}` : 'none',
  }
}

const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'
const miniLabelCls = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1'

function CampaignButtonsPanel({
  buttons,
  setButtons,
  multipleAllowed,
  setMultipleAllowed,
}: {
  buttons: CampaignButton[]
  setButtons: React.Dispatch<React.SetStateAction<CampaignButton[]>>
  multipleAllowed: boolean
  setMultipleAllowed: (v: boolean) => void
}) {
  const dragIndex = useRef<number | null>(null)

  const update = (id: string, patch: Partial<CampaignButton>) =>
    setButtons(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)))

  const reorder = (from: number, to: number) => {
    if (from === to) return
    setButtons(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto">
      <label className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={multipleAllowed}
          onChange={e => setMultipleAllowed(e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
        <div>
          <p className="text-sm font-semibold text-slate-800">Multiple answers allowed?</p>
          <p className="text-xs text-slate-400">When enabled, a contact can click more than one button in this campaign.</p>
        </div>
      </label>

      {buttons.length === 0 && (
        <div className="text-center py-10 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <MousePointerClick size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No campaign buttons yet</p>
          <p className="text-xs text-slate-400 mt-1">Add buttons your contacts can click to answer this campaign.</p>
        </div>
      )}

      {buttons.map((b, i) => (
        <div
          key={b.id}
          draggable
          onDragStart={() => { dragIndex.current = i }}
          onDragOver={e => e.preventDefault()}
          onDrop={() => { if (dragIndex.current !== null) reorder(dragIndex.current, i); dragIndex.current = null }}
          className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center gap-2">
            <GripVertical size={15} className="text-slate-300 cursor-grab shrink-0" />
            <input
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={b.text}
              onChange={e => update(b.id, { text: e.target.value })}
              placeholder="Button label…"
            />
            <button
              type="button"
              onClick={() => setButtons(prev => prev.filter(x => x.id !== b.id))}
              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove button"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 pl-6">
            <div>
              <label className={miniLabelCls}>Background</label>
              <input
                type="color"
                value={b.bg_color}
                onChange={e => update(b.id, { bg_color: e.target.value })}
                className="w-full h-8 border border-slate-200 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className={miniLabelCls}>Text color</label>
              <input
                type="color"
                value={b.text_color}
                onChange={e => update(b.id, { text_color: e.target.value })}
                className="w-full h-8 border border-slate-200 rounded cursor-pointer"
              />
            </div>
            <div>
              <label className={miniLabelCls}>Font size ({b.font_size}px)</label>
              <input
                type="number"
                min={10}
                max={28}
                value={b.font_size}
                onChange={e => update(b.id, { font_size: Number(e.target.value) || 14 })}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className={miniLabelCls}>Corner radius ({b.border_radius}px)</label>
              <input
                type="range"
                min={0}
                max={24}
                value={b.border_radius}
                onChange={e => update(b.id, { border_radius: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
            </div>
            <div>
              <label className={miniLabelCls}>Border width ({b.border_width}px)</label>
              <input
                type="number"
                min={0}
                max={6}
                value={b.border_width}
                onChange={e => {
                  const width = Number(e.target.value) || 0
                  update(b.id, { border_width: width, border_color: width > 0 ? (b.border_color ?? '#5BA4F5') : b.border_color })
                }}
                className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            {b.border_width > 0 ? (
              <div>
                <label className={miniLabelCls}>Border color</label>
                <input
                  type="color"
                  value={b.border_color ?? '#5BA4F5'}
                  onChange={e => update(b.id, { border_color: e.target.value })}
                  className="w-full h-8 border border-slate-200 rounded cursor-pointer"
                />
              </div>
            ) : (
              <div>
                <label className={miniLabelCls}>Font weight</label>
                <select
                  value={b.font_weight}
                  onChange={e => update(b.id, { font_weight: e.target.value })}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="400">Regular</option>
                  <option value="500">Medium</option>
                  <option value="600">Semibold</option>
                  <option value="700">Bold</option>
                </select>
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setButtons(prev => [...prev, newCampaignButton()])}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 text-sm font-semibold rounded-xl transition-colors"
      >
        <Plus size={14} />
        Add button
      </button>

      {buttons.length > 0 && (
        <div>
          <p className={labelCls}>Live preview</p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center">
            {buttons.map(b => (
              <span key={b.id} style={buttonStyle(b)}>{b.text || 'Button'}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
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
  const [multipleAllowed, setMultipleAllowed] = useState(false)
  const [activeTab, setActiveTab] = useState<EditorTab>('design')
  const [editorReady, setEditorReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/tickets/templates').then(r => r.data),
  })

  const hasSelection = isNew || selectedId !== null

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
    const parsed = parseButtons(t.campaign_buttons)
    setButtons(parsed)
    setMultipleAllowed(parsed.some(b => b.multiple_allowed))
    setActiveTab('design')
    setSaveError('')
    loadIntoEditor(t.design_json)
  }

  function openNew() {
    setSelectedId(null)
    setIsNew(true)
    setName('')
    setExistingBody('')
    setButtons([])
    setMultipleAllowed(false)
    setActiveTab('design')
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
        campaign_buttons: buttons.map(b => ({ ...b, multiple_allowed: multipleAllowed })),
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

            <div className="flex gap-2 px-5 pt-3">
              {([
                { value: 'design', label: 'Email Design' },
                { value: 'buttons', label: 'Campaign Buttons' },
              ] as { value: EditorTab; label: string }[]).map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    activeTab === tab.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                  {tab.value === 'buttons' && buttons.length > 0 && (
                    <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeTab === 'buttons' ? 'bg-white/25 text-white' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {buttons.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Unlayer stays mounted across tab switches so the canvas state survives */}
              <div className={`relative flex-1 min-h-[500px] m-5 mb-3 border border-slate-200 rounded-xl overflow-hidden ${activeTab === 'design' ? '' : 'hidden'}`}>
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
                  }}
                />
              </div>

              {activeTab === 'buttons' && (
                <CampaignButtonsPanel
                  buttons={buttons}
                  setButtons={setButtons}
                  multipleAllowed={multipleAllowed}
                  setMultipleAllowed={setMultipleAllowed}
                />
              )}
            </div>

            <div className="px-5 pb-4 shrink-0">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1">Signature preview</p>
                {user?.email_signature ? (
                  <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">{user.email_signature}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No signature set — add one in Profile settings.</p>
                )}
                <p className="text-[11px] text-slate-400 mt-1.5">Your active signature will appear below the email body when sent.</p>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
