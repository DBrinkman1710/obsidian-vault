import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../../../api/client'

interface Template {
  id: string
  name: string
  body: string
  created_at: string
}

interface FormState {
  name: string
  body: string
}

const EMPTY: FormState = { name: '', body: '' }

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function TemplateForm({ initial, onSave, onCancel, isPending }: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState('')
  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.body.trim()) { setError('Body is required'); return }
    setError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div>
        <label className={labelCls}>Template name *</label>
        <input className={inputCls} value={form.name} onChange={set('name')} placeholder="e.g. Refund confirmation" autoFocus />
      </div>
      <div>
        <label className={labelCls}>Body *</label>
        <textarea
          className={`${inputCls} resize-vertical min-h-[120px] font-[inherit]`}
          value={form.body}
          onChange={set('body')}
          placeholder="Thank you for reaching out. We have processed your request and…"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
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

export default function TemplatesPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/tickets/templates').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post('/tickets/templates', { name: f.name.trim(), body: f.body.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setShowCreate(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      api.patch(`/tickets/templates/${id}`, { name: f.name.trim(), body: f.body.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tickets/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Response Templates</h1>
          <p className="text-sm text-slate-500">
            Reusable reply bodies you can insert in drafts and composed emails. AI can suggest the best match for each conversation.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Template
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New Template</p>
          <TemplateForm
            initial={EMPTY}
            onSave={f => createMutation.mutate(f)}
            onCancel={() => setShowCreate(false)}
            isPending={createMutation.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && templates?.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <FileText size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No templates yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to speed up replies with reusable copy.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {templates?.map(tmpl => (
          <div key={tmpl.id}>
            {editingId === tmpl.id ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Edit "{tmpl.name}"</p>
                <TemplateForm
                  initial={{ name: tmpl.name, body: tmpl.body }}
                  onSave={f => updateMutation.mutate({ id: tmpl.id, f })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between shadow-sm">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="text-sm font-bold text-slate-900 mb-1">{tmpl.name}</p>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 whitespace-pre-wrap">{tmpl.body}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditingId(tmpl.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${tmpl.name}"?`)) deleteMutation.mutate(tmpl.id) }}
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
