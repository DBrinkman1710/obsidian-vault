import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Tag, Palette } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'
import { LabelChip, type ContactLabel } from '../../contacts/components/LabelChip'

interface FormState {
  name: string
  color: string
}

const EMPTY: FormState = { name: '', color: '#64748b' }

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

const DEFAULT_COLOR = '#5BA4F5'

function BrandingSection() {
  const config = useTenantConfig()
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
  )
}

function errorDetail(err: unknown): string {
  const detail = (err as any)?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Something went wrong — try again.'
}

function LabelForm({ initial, onSave, onCancel, isPending, serverError }: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  isPending: boolean
  serverError: string | null
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className={labelCls}>Label name *</label>
          <input
            className={inputCls} value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="potential client" maxLength={100} autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color" value={form.color}
              onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
              className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
            />
            <span className="text-sm text-slate-500 font-mono">{form.color}</span>
          </div>
        </div>
        <div className="pb-1.5">
          <LabelChip label={{ id: 'preview', name: form.name.trim() || 'Preview', color: form.color }} />
        </div>
      </div>
      {(error || serverError) && <p className="text-sm text-red-500">{error || serverError}</p>}
      <div className="flex gap-3">
        <button
          type="submit" disabled={isPending}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function LabelsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: labels, isLoading } = useQuery<ContactLabel[]>({
    queryKey: ['contact-labels'],
    queryFn: () => api.get('/contacts/labels').then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contact-labels'] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
  }

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post('/contacts/labels', { name: f.name.trim(), color: f.color }),
    onSuccess: () => { invalidate(); setShowCreate(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      api.patch(`/contacts/labels/${id}`, { name: f.name.trim(), color: f.color }),
    onSuccess: () => { invalidate(); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/labels/${id}`),
    onSuccess: invalidate,
  })

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return <p className="text-sm text-red-500 p-8">Access denied — admin only.</p>
  }

  return (
    <div className="max-w-3xl">
      <BrandingSection />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Contact labels</h1>
          <p className="text-sm text-slate-500">
            Define your own workflow labels and assign them to contacts — e.g. “potential client”, “process step 1”, “after sales”.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Label
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New Label</p>
          <LabelForm
            initial={EMPTY}
            onSave={f => createMutation.mutate(f)}
            onCancel={() => { setShowCreate(false); createMutation.reset() }}
            isPending={createMutation.isPending}
            serverError={createMutation.isError ? errorDetail(createMutation.error) : null}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && labels?.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Tag size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No labels yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to start organizing your contacts.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {labels?.map(label => (
          <div key={label.id}>
            {editingId === label.id ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Edit {label.name}</p>
                <LabelForm
                  initial={{ name: label.name, color: label.color }}
                  onSave={f => updateMutation.mutate({ id: label.id, f })}
                  onCancel={() => { setEditingId(null); updateMutation.reset() }}
                  isPending={updateMutation.isPending}
                  serverError={updateMutation.isError ? errorDetail(updateMutation.error) : null}
                />
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <LabelChip label={label} />
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => { setEditingId(label.id); setShowCreate(false) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${label.name}"? It will be removed from all contacts.`)) deleteMutation.mutate(label.id) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={11} />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
