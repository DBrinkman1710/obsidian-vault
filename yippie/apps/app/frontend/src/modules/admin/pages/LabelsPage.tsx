import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, BotMessageSquare, Code2, Copy, GripVertical, Layers, MessageSquare, Palette, Building2, Plus, RefreshCcw, Settings2, Tag, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useCopy } from '../../../hooks/useCopy'
import { useTenantConfig } from '../../../App'
import { fmtDateTime } from '../../../lib/format'
import { SendcloudSettingsCard } from '../../shipments/components/SendcloudSettingsCard'
import YipTrainModal from '../../../components/YipTrainModal'

interface PipelineStage {
  id: string
  name: string
  color: string
  display_order: number
  contact_count: number
}

const DEFAULT_COLOR = '#5BA4F5'

function OrgDetailsCard() {
  const [kvk, setKvk] = useState('')
  const [btw, setBtw] = useState('')

  const { data } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.get('/team/org-settings').then((r: any) => r.data),
  })
  useEffect(() => {
    if (data) { setKvk(data.kvk_nummer ?? ''); setBtw(data.btw_nummer ?? '') }
  }, [data])

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/org-settings', { kvk_nummer: kvk, btw_nummer: btw }),
    onSuccess: () => toast.success('Organisation details saved'),
    onError: () => toast.error('Failed to save'),
  })

  const dirty = kvk !== (data?.kvk_nummer ?? '') || btw !== (data?.btw_nummer ?? '')

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Organisation details</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Your Dutch registration numbers. These appear on invoice exports.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">KvK-nummer</label>
          <input
            value={kvk}
            onChange={e => setKvk(e.target.value)}
            placeholder="12345678"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Btw-nummer</label>
          <input
            value={btw}
            onChange={e => setBtw(e.target.value)}
            placeholder="NL123456789B01"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
      </div>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !dirty}
        className="px-4 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
      >
        {mutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function LiveChatSettingsCard() {
  const [hours, setHours] = useState('')

  const { data } = useQuery({
    queryKey: ['chat-settings'],
    queryFn: () => api.get('/chat/settings').then((r: any) => r.data),
  })
  useEffect(() => {
    if (data) setHours(String(data.hide_solved_chats_hours ?? 72))
  }, [data])

  const mutation = useMutation({
    mutationFn: () => api.patch('/chat/settings', { hide_solved_chats_hours: Number(hours) }),
    onSuccess: () => toast.success('Live chat settings saved'),
    onError: () => toast.error('Failed to save'),
  })

  const dirty = hours !== String(data?.hide_solved_chats_hours ?? '')

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Live Chat</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Solved conversations drop off the active list after this window. Messages are kept permanently. This only hides them from view.
      </p>
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Hide solved chats after (hours)</label>
          <input
            type="number"
            min={1}
            value={hours}
            onChange={e => setHours(e.target.value)}
            className="w-40 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !dirty || !hours}
          className="px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

interface WidgetSettings {
  tenant_slug: string
  accent_color: string
  lead_widget_enabled: boolean
  lead_widget_button_text: string
  lead_widget_heading: string
  booking_widget_enabled: boolean
  booking_widget_button_text: string
  booking_widget_heading: string
  chat_snippet: string
  lead_snippet: string
  booking_snippet: string
  booking_page_url: string
}

function SnippetRow({ label, hint, value }: { label: string; hint: string; value: string }) {
  const { copy } = useCopy()
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-semibold text-slate-500">{label}</label>
        <span className="text-xs text-slate-400">{hint}</span>
      </div>
      <div className="flex gap-2 items-start">
        <pre className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono text-slate-700">{value}</pre>
        <button
          onClick={() => copy(value, `${label} snippet copied`)}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Copy size={13} /> Copy
        </button>
      </div>
    </div>
  )
}

/**
 * [WGT1] Embed snippets for the client's own website.
 *
 * Any member can see and copy a snippet — that is not a privileged action, and
 * previously the lead snippet was only reachable from the superadmin page, so
 * clients could not self serve. Changing how the widgets look, or switching one
 * off, is admin only and enforced server side by PATCH /team/widget-settings.
 */
function WebsiteWidgetsCard({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<WidgetSettings>>({})

  const { data } = useQuery<WidgetSettings>({
    queryKey: ['widget-settings'],
    queryFn: () => api.get('/team/widget-settings').then((r: any) => r.data),
  })
  useEffect(() => { if (data) setForm(data) }, [data])

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/widget-settings', {
      accent_color: form.accent_color,
      lead_widget_enabled: form.lead_widget_enabled,
      lead_widget_button_text: form.lead_widget_button_text,
      lead_widget_heading: form.lead_widget_heading,
      booking_widget_enabled: form.booking_widget_enabled,
      booking_widget_button_text: form.booking_widget_button_text,
      booking_widget_heading: form.booking_widget_heading,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['widget-settings'] })
      toast.success('Widget settings saved')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Failed to save'),
  })

  if (!data) return null

  const dirty = (['accent_color', 'lead_widget_enabled', 'lead_widget_button_text', 'lead_widget_heading',
    'booking_widget_enabled', 'booking_widget_button_text', 'booking_widget_heading'] as const)
    .some(k => form[k] !== data[k])

  const set = (patch: Partial<WidgetSettings>) => setForm(p => ({ ...p, ...patch }))
  const inputCls = 'input-base'
  const labelCls = 'block text-xs font-semibold text-slate-500 mb-1.5'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Code2 size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Website widgets</h2>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Paste a snippet into your website to embed live chat, an enquiry form, or a booking
        calendar. Styling below applies to every site using them — no need to paste again after
        a change.
      </p>

      <SnippetRow label="Live chat" hint="chat bubble" value={data.chat_snippet} />
      <SnippetRow label="Enquiry form" hint="contact form" value={data.lead_snippet} />
      <SnippetRow label="Booking" hint="slot picker" value={data.booking_snippet} />

      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className={labelCls}>Booking page link</p>
        <p className="text-xs text-slate-500">
          Prefer a plain link over an embed?{' '}
          <a href={data.booking_page_url} target="_blank" rel="noreferrer"
            className="text-yippie font-semibold hover:opacity-80 break-all">{data.booking_page_url}</a>
        </p>
      </div>

      <div className="mt-5 pt-5 border-t border-slate-100">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Appearance</p>

        {!isAdmin && (
          <p className="text-xs text-slate-500 mb-3">
            Only admins can change these settings.
          </p>
        )}

        <fieldset disabled={!isAdmin} className={isAdmin ? '' : 'opacity-60'}>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="color"
              value={form.accent_color ?? '#5BA4F5'}
              onChange={e => set({ accent_color: e.target.value })}
              className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-slate-500 font-mono">{form.accent_color}</span>
            <span className="text-xs text-slate-400">Button and header colour</span>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.lead_widget_enabled ?? true}
                  onChange={e => set({ lead_widget_enabled: e.target.checked })}
                />
                <span className="text-sm font-semibold text-slate-700">Enquiry form</span>
              </label>
              <label className={labelCls}>Button text</label>
              <input className={`${inputCls} mb-2`} value={form.lead_widget_button_text ?? ''}
                onChange={e => set({ lead_widget_button_text: e.target.value })} placeholder="Get in touch" />
              <label className={labelCls}>Panel heading</label>
              <input className={inputCls} value={form.lead_widget_heading ?? ''}
                onChange={e => set({ lead_widget_heading: e.target.value })} placeholder="Contact us" />
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.booking_widget_enabled ?? true}
                  onChange={e => set({ booking_widget_enabled: e.target.checked })}
                />
                <span className="text-sm font-semibold text-slate-700">Booking</span>
              </label>
              <label className={labelCls}>Button text</label>
              <input className={`${inputCls} mb-2`} value={form.booking_widget_button_text ?? ''}
                onChange={e => set({ booking_widget_button_text: e.target.value })} placeholder="Book a meeting" />
              <label className={labelCls}>Panel heading</label>
              <input className={inputCls} value={form.booking_widget_heading ?? ''}
                onChange={e => set({ booking_widget_heading: e.target.value })} placeholder="Pick a time" />
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !dirty}
              className="mt-5 px-4 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
        </fieldset>
      </div>
    </div>
  )
}

function KanbanStagesPanel() {
  const qc = useQueryClient()
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#64748b')
  const [error, setError] = useState('')
  const dragIdx = useRef<number | null>(null)

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['pipeline-stages'] })
    qc.invalidateQueries({ queryKey: ['pipeline-board'] })
  }

  const createMut = useMutation({
    mutationFn: (b: object) => api.post('/pipeline/stages', b),
    onSuccess: () => { invalidate(); resetForm() },
    onError: () => setError('Save failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, b }: { id: string; b: object }) => api.patch(`/pipeline/stages/${id}`, b),
    onSuccess: () => { invalidate(); resetForm() },
    onError: () => setError('Save failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/pipeline/stages/${id}`),
    onSuccess: () => invalidate(),
  })
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => api.put('/pipeline/stages/reorder', { ids }),
    onSuccess: () => invalidate(),
  })

  function resetForm() { setEditId(null); setName(''); setColor('#64748b'); setError('') }
  function startEdit(s: PipelineStage) { setEditId(s.id); setName(s.name); setColor(s.color); setError('') }
  function handleSave() {
    if (!name.trim()) { setError('Name required'); return }
    const body = { name: name.trim(), color }
    if (editId) updateMut.mutate({ id: editId, b: body })
    else createMut.mutate(body)
  }

  function onDragStart(i: number) { dragIdx.current = i }
  function onDrop(i: number) {
    const from = dragIdx.current
    if (from === null || from === i) return
    const ids = [...stages.map((s: any) => s.id)]
    const [moved] = ids.splice(from, 1)
    ids.splice(i, 0, moved)
    reorderMut.mutate(ids)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
      {/* Header */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-100">
        <Layers size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Kanban stages</h2>
        <span className="ml-auto text-xs text-slate-400">{stages.length} stage{stages.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Stage list */}
      <div className="divide-y divide-slate-50">
        {stages.length === 0 && (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">No stages yet. Add one below.</p>
        )}
        {stages.map((s: any, i: any) => (
          <div
            key={s.id}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} className="text-slate-300 shrink-0" />
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
            </div>
            <span className="text-xs text-slate-400 shrink-0">{s.contact_count} contact{s.contact_count !== 1 ? 's' : ''}</span>
            <button
              onClick={() => startEdit(s)}
              className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Settings2 size={13} />
            </button>
            <button
              onClick={() => { if (confirm(`Delete "${s.name}"? Contacts will be removed from this stage.`)) deleteMut.mutate(s.id) }}
              className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Add / edit form */}
      <div className="border-t border-slate-100 px-6 py-5 bg-slate-50 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          {editId ? 'Edit stage' : 'New stage'}
        </p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Stage name…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
            title="Stage colour"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={createMut.isPending || updateMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            <Plus size={14} />
            {editId ? 'Update stage' : 'Add stage'}
          </button>
          {editId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-sm font-semibold text-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ContactLabel {
  id: string
  name: string
  color: string
}

function ContactLabelsCard() {
  const qc = useQueryClient()
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#64748b')
  const [error, setError] = useState('')

  const { data: labels = [] } = useQuery<ContactLabel[]>({
    queryKey: ['contact-labels'],
    queryFn: () => api.get('/contacts/labels').then((r: any) => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['contact-labels'] })

  const createMut = useMutation({
    mutationFn: (b: object) => api.post('/contacts/labels', b),
    onSuccess: () => { invalidate(); resetForm() },
    onError: () => setError('Save failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, b }: { id: string; b: object }) => api.patch(`/contacts/labels/${id}`, b),
    onSuccess: () => { invalidate(); resetForm() },
    onError: () => setError('Save failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/labels/${id}`),
    onSuccess: () => invalidate(),
  })

  // [UX-PSYCH] Friction reduction: no confirm modal — delete immediately and
  // offer a 5s Undo that recreates the label with the same name/colour.
  // (Contact↔label assignments are not restored; the label itself is.)
  function deleteWithUndo(l: ContactLabel) {
    deleteMut.mutate(l.id, {
      onSuccess: () => {
        toast(`Deleted label "${l.name}"`, {
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              api.post('/contacts/labels', { name: l.name, color: l.color })
                .then(() => { invalidate(); toast.success('Label restored') })
                .catch(() => toast.error('Could not restore label'))
            },
          },
        })
      },
      onError: () => toast.error('Failed to delete label'),
    })
  }

  function resetForm() { setEditId(null); setName(''); setColor('#64748b'); setError('') }
  function startEdit(l: ContactLabel) { setEditId(l.id); setName(l.name); setColor(l.color); setError('') }
  function handleSave() {
    if (!name.trim()) { setError('Name required'); return }
    const body = { name: name.trim(), color }
    if (editId) updateMut.mutate({ id: editId, b: body })
    else createMut.mutate(body)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-100">
        <Tag size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Contact labels</h2>
        <span className="ml-auto text-xs text-slate-400">{labels.length} label{labels.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="divide-y divide-slate-50">
        {labels.length === 0 && (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">No labels yet. Add one below.</p>
        )}
        {labels.map((l: any) => (
          <div key={l.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: l.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{l.name}</p>
            </div>
            <button
              onClick={() => startEdit(l)}
              className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Settings2 size={13} />
            </button>
            <button
              onClick={() => deleteWithUndo(l)}
              className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-6 py-5 bg-slate-50 space-y-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          {editId ? 'Edit label' : 'New label'}
        </p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="Label name…"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
            title="Label colour"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={createMut.isPending || updateMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            <Plus size={14} />
            {editId ? 'Update label' : 'Add label'}
          </button>
          {editId && (
            <button
              onClick={resetForm}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-sm font-semibold text-slate-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AiYipCard() {
  const config = useTenantConfig()
  const existing = config?.ai_profile
  const [businessDescription, setBusinessDescription] = useState(existing?.business_description ?? '')
  const [tone, setTone] = useState(existing?.tone ?? 'friendly')
  const [replyLanguage, setReplyLanguage] = useState(existing?.reply_language ?? 'en')
  const [signOff, setSignOff] = useState(existing?.sign_off ?? '')
  const [commonTerms, setCommonTerms] = useState(existing?.common_terms ?? '')
  const [showTrain, setShowTrain] = useState(false)

  useEffect(() => {
    if (existing) {
      setBusinessDescription(existing.business_description ?? '')
      setTone(existing.tone ?? 'friendly')
      setReplyLanguage(existing.reply_language ?? 'en')
      setSignOff(existing.sign_off ?? '')
      setCommonTerms(existing.common_terms ?? '')
    }
  }, [config?.ai_profile])

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/ai-profile', {
      business_description: businessDescription,
      tone,
      reply_language: replyLanguage,
      sign_off: signOff,
      common_terms: commonTerms,
    }),
    onSuccess: () => toast.success('AI profile saved'),
    onError: () => toast.error('Failed to save'),
  })

  const inputCls = 'input-base'
  const labelCls = 'block text-xs font-semibold text-slate-500 mb-1.5'

  return (
    <>
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <BotMessageSquare size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">AI & Yip</h2>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Tell Yip about your business so AI-generated replies match your brand voice.
      </p>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Business description</label>
          <textarea
            rows={3}
            value={businessDescription}
            onChange={e => setBusinessDescription(e.target.value)}
            placeholder="e.g. We sell specialty coffee equipment to cafes and home brewers."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tone</label>
            <select
              value={tone}
              onChange={e => setTone(e.target.value)}
              className={inputCls}
            >
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="formal">Formal</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Reply language</label>
            <select
              value={replyLanguage}
              onChange={e => setReplyLanguage(e.target.value)}
              className={inputCls}
            >
              <option value="en">English</option>
              <option value="nl">Dutch</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="es">Spanish</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Sign-off name</label>
          <input
            type="text"
            value={signOff}
            onChange={e => setSignOff(e.target.value)}
            placeholder="e.g. The Acme Team"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Common terms & abbreviations</label>
          <textarea
            rows={2}
            value={commonTerms}
            onChange={e => setCommonTerms(e.target.value)}
            placeholder="e.g. PO = purchase order, ETA = estimated time of arrival"
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-4 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
        >
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setShowTrain(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
        >
          <RefreshCcw size={13} />
          Re-run Yip training
        </button>
      </div>
    </div>

    {showTrain && (
      <YipTrainModal
        tenantName={config?.tenant_name ?? ''}
        onComplete={() => {
          setShowTrain(false)
          window.location.reload()
        }}
        onDismiss={() => setShowTrain(false)}
      />
    )}
    </>
  )
}

interface KbSource {
  id: string
  url: string
  status: 'pending' | 'ok' | 'failed'
  last_fetched_at: string | null
  error: string | null
  char_count: number
  chunk_count: number
  created_at: string
}

/**
 * [YIP-KB] Yip knowledge — the tenant's own FAQ/Q&A page as grounding for AI
 * reply drafts. One URL; fetched server side, chunked, and injected into
 * suggest-reply prompts when relevant.
 */
function YipKnowledgeCard() {
  const qc = useQueryClient()
  const [url, setUrl] = useState('')

  const { data: source } = useQuery<KbSource | null>({
    queryKey: ['kb_source'],
    queryFn: () => api.get('/knowledge/source').then((r: any) => r.data),
    // Poll while a fetch is running so the status line flips to ok/failed by itself.
    refetchInterval: q => (q.state.data?.status === 'pending' ? 2000 : false),
  })
  useEffect(() => { if (source) setUrl(source.url) }, [source?.url])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['kb_source'] })

  const saveMut = useMutation({
    mutationFn: () => api.put('/knowledge/source', { url: url.trim() }),
    onSuccess: () => { invalidate(); toast.success('Fetching your page…') },
    onError: (e: any) => toast.error(e.response?.data?.detail?.[0]?.msg ?? e.response?.data?.detail ?? 'Failed to save'),
  })
  const refetchMut = useMutation({
    mutationFn: () => api.post('/knowledge/source/refetch'),
    onSuccess: () => { invalidate(); toast.success('Re-fetching your page…') },
    onError: () => toast.error('Failed to start the re-fetch'),
  })
  const removeMut = useMutation({
    mutationFn: () => api.delete('/knowledge/source'),
    onSuccess: () => { setUrl(''); invalidate(); toast.success('Knowledge source removed') },
    onError: () => toast.error('Failed to remove'),
  })

  const dirty = url.trim() !== (source?.url ?? '') && url.trim().length > 0

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Yip knowledge</h2>
      </div>
      <p className="text-sm text-slate-500 mb-5">
        Point Yip at your own FAQ or help page. Reply drafts will use the answers on that page
        instead of guessing.
      </p>

      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Q&A page URL</label>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && dirty && saveMut.mutate()}
          placeholder="https://yourcompany.nl/faq"
          className="input-base flex-1"
        />
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !dirty}
          className="px-4 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
        >
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      {source && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          {source.status === 'pending' && (
            <span className="text-xs text-slate-500">Fetching your page…</span>
          )}
          {source.status === 'ok' && (
            <span className="text-xs text-slate-500">
              Fetched · {source.chunk_count} section{source.chunk_count !== 1 ? 's' : ''}
              {source.last_fetched_at && ` · last updated ${fmtDateTime(source.last_fetched_at)}`}
            </span>
          )}
          {source.status === 'failed' && (
            <span className="text-xs text-danger-600">Fetch failed{source.error ? ` — ${source.error}` : ''}</span>
          )}
          <span className="ml-auto flex gap-2">
            <button
              onClick={() => refetchMut.mutate()}
              disabled={refetchMut.isPending || source.status === 'pending'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-xl transition-colors"
            >
              <RefreshCcw size={12} /> Re-fetch
            </button>
            <button
              onClick={() => removeMut.mutate()}
              disabled={removeMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-danger-600 border border-danger-200 hover:bg-danger-50 disabled:opacity-50 rounded-xl transition-colors"
            >
              <Trash2 size={12} /> Remove
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

export default function LabelsPage() {
  const { user } = useAuth()
  const config = useTenantConfig()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [color, setColor] = useState(config?.branding?.primary_color ?? DEFAULT_COLOR)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/branding', { primary_color: color }),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      window.location.reload()
    },
  })

  return (
    <div className="max-w-3xl">
      <OrgDetailsCard />
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Brand colour</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          The accent colour used throughout the sidebar and interface for your workspace.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={e => { setColor(e.target.value); setSaved(false) }}
            className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
          />
          <span className="text-sm text-slate-500 font-mono">{color}</span>
          <button
            type="button"
            onClick={() => { setColor(DEFAULT_COLOR); setSaved(false) }}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-lg transition-colors"
          >
            Reset to default
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || color === (config?.branding?.primary_color ?? DEFAULT_COLOR)}
            className="px-4 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {mutation.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {mutation.isError && <p className="mt-2 text-xs text-red-500">Failed to save. Try again.</p>}
      </div>
      <WebsiteWidgetsCard isAdmin={isAdmin} />
      {isAdmin && <AiYipCard />}
      {isAdmin && config?.enabled_modules?.includes('ai') && <YipKnowledgeCard />}
      {isAdmin && <ContactLabelsCard />}
      {isAdmin && <LiveChatSettingsCard />}
      {isAdmin && <KanbanStagesPanel />}
      {isAdmin && config?.enabled_modules?.includes('tracking') && <SendcloudSettingsCard />}
    </div>
  )
}
