import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Layers, Palette, Building2, Plus, Settings2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'

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
    queryFn: () => api.get('/team/org-settings').then(r => r.data),
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
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {mutation.isPending ? 'Saving…' : 'Save'}
      </button>
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
    queryFn: () => api.get('/pipeline/stages').then(r => r.data),
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
    const ids = [...stages.map(s => s.id)]
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
        {stages.map((s, i) => (
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
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
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
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {mutation.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {mutation.isError && <p className="mt-2 text-xs text-red-500">Failed to save — try again.</p>}
      </div>
      {isAdmin && <KanbanStagesPanel />}
    </div>
  )
}
