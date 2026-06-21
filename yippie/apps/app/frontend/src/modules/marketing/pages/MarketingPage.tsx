import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import GrapesEditor, { GrapesEditorHandle, type PipelineStage, type CampaignButton } from '../../admin/components/GrapesEditor'
import { FileText, Loader2, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '../../../api/client'
import { fetchLabels, type ContactLabel } from '../../contacts/components/LabelChip'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'

interface Campaign {
  id: string
  name: string
  subject: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed'
  dispatch_channel: 'email' | 'whatsapp'
  created_at: string
  updated_at: string
}

interface CampaignTemplate {
  id: string
  campaign_id: string
  raw_html: string | null
  design_json: string | null
  campaign_buttons: string | null
  variant: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  scheduled: 'bg-blue-50 text-blue-600',
  sending: 'bg-amber-50 text-amber-600',
  completed: 'bg-green-50 text-green-600',
}

export default function MarketingPage() {
  const qc = useQueryClient()
  const editorRef = useRef<GrapesEditorHandle>(null)
  const pendingDesignRef = useRef<string | null | undefined>(undefined)
  const ctx = useContextMenu()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [editorReady, setEditorReady] = useState(false)
  const [editorEverOpened, setEditorEverOpened] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ['marketing-campaigns'],
    queryFn: () => api.get('/marketing/campaigns').then(r => r.data),
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

  async function openCampaign(c: Campaign) {
    setEditorEverOpened(true)
    setSelectedId(c.id)
    setIsNew(false)
    setName(c.name)
    setSubject(c.subject)
    setSaveError('')
    // Load the default (null-variant) template's design
    try {
      const templates: CampaignTemplate[] = await api.get(`/marketing/campaigns/${c.id}/templates`).then(r => r.data)
      const defaultTpl = templates.find(t => t.variant === null) ?? templates[0] ?? null
      loadIntoEditor(defaultTpl?.design_json ?? null)
    } catch {
      loadIntoEditor(null)
    }
  }

  function openNew() {
    setEditorEverOpened(true)
    setSelectedId(null)
    setIsNew(true)
    setName('')
    setSubject('')
    setSaveError('')
    loadIntoEditor(null)
  }

  function clearSelection() {
    setSelectedId(null)
    setIsNew(false)
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/marketing/campaigns/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
      if (id === selectedId) clearSelection()
    },
  })

  function handleSave() {
    const editor = editorRef.current
    if (!editor || saving) return
    if (!name.trim()) { setSaveError('Campaign name is required'); return }
    if (!subject.trim()) { setSaveError('Email subject is required'); return }
    setSaveError('')
    setSaving(true)

    editor.exportHtml(async ({ design, html, campaignButtons }: { design: object; html: string; campaignButtons: CampaignButton[] }) => {
      const templatePayload = {
        templates: [{
          variant: null,
          raw_html: html,
          design_json: JSON.stringify(design),
          campaign_buttons: campaignButtons,
        }],
      }

      if (isNew) {
        try {
          const created: Campaign = await api.post('/marketing/campaigns', {
            name: name.trim(),
            subject: subject.trim(),
          }).then(r => r.data)
          await api.post(`/marketing/campaigns/${created.id}/templates`, templatePayload)
          qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
          setIsNew(false)
          setSelectedId(created.id)
          setSaving(false)
        } catch {
          setSaving(false)
          setSaveError('Save failed — please try again')
        }
      } else if (selectedId) {
        try {
          await Promise.all([
            api.patch(`/marketing/campaigns/${selectedId}`, { name: name.trim(), subject: subject.trim() }),
            api.post(`/marketing/campaigns/${selectedId}/templates`, templatePayload),
          ])
          qc.invalidateQueries({ queryKey: ['marketing-campaigns'] })
          setSaving(false)
        } catch {
          setSaving(false)
          setSaveError('Save failed — please try again')
        }
      }
    })
  }

  return (
    <>
      {/* Campaign list */}
      <div className="h-[calc(100vh-6rem)] min-h-[560px]">
        <aside className="w-[360px] h-full bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Megaphone size={15} className="text-slate-500" />
              <h1 className="text-sm font-bold text-slate-900">Campaigns</h1>
            </div>
            <button
              onClick={openNew}
              title="New campaign"
              className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && <p className="text-xs text-slate-400 px-4 py-4">Loading…</p>}

            {isNew && (
              <div className="px-4 py-3 bg-blue-50 border-l-2 border-blue-600">
                <p className="text-sm font-semibold text-blue-700 truncate">{name.trim() || 'New campaign'}</p>
                <p className="text-[11px] text-blue-400">Unsaved</p>
              </div>
            )}

            {!isLoading && campaigns?.length === 0 && !isNew && (
              <div className="text-center px-4 py-10">
                <FileText size={26} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No campaigns yet. Create one with the + button.</p>
              </div>
            )}

            {campaigns?.map(c => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 px-4 py-3 border-l-2 cursor-pointer transition-colors ${
                  c.id === selectedId
                    ? 'bg-blue-50 border-blue-600'
                    : 'border-transparent hover:bg-slate-50'
                }`}
                onClick={() => openCampaign(c)}
                onContextMenu={e => ctx.open(e, [
                  { header: c.name },
                  { label: 'Edit campaign', icon: <Pencil size={14} />, onClick: () => openCampaign(c) },
                  { separator: true },
                  { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => { if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id) } },
                ])}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${c.id === selectedId ? 'text-blue-700' : 'text-slate-800'}`}>
                    {c.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[c.status]}`}>
                      {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate">{c.subject}</span>
                  </div>
                </div>
                {c.status === 'draft' && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm(`Delete "${c.name}"?`)) deleteMutation.mutate(c.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                    title="Delete campaign"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Full-screen editor modal — identical popup pattern to TemplatesPage */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
          hasSelection ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white rounded-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <input
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Campaign name…"
              />
              <input
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject…"
              />
            </div>
            {saveError && <p className="text-xs text-red-500 shrink-0">{saveError}</p>}
            <button
              onClick={handleSave}
              disabled={saving || !editorReady}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save'}
            </button>
            <button
              onClick={clearSelection}
              className="shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title="Close editor"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
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
      </div>
      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </>
  )
}
