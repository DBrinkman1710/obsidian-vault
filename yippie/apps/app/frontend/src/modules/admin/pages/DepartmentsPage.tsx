import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

interface Dept {
  id: string
  name: string
  email: string
  reply_template: string | null
  sla_working_days: number
  created_at: string
}

interface FormState {
  name: string
  email: string
  reply_template: string
  sla_working_days: string
}

const EMPTY: FormState = { name: '', email: '', reply_template: '', sla_working_days: '3' }

const DEFAULT_TEMPLATE_HINT =
  'Leave blank to use the default: "I\'m sorry to hear about your situation. I have informed my colleagues at {name} about your inquiry. You can expect a response within {sla} working days."'

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function DeptForm({ initial, onSave, onCancel, isPending }: {
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
    if (!form.email.trim()) { setError('Email is required'); return }
    setError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Department name *</label>
          <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Finance" autoFocus />
        </div>
        <div>
          <label className={labelCls}>Email address *</label>
          <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="finance@company.nl" />
        </div>
      </div>
      <div>
        <label className={labelCls}>SLA (working days)</label>
        <input
          className={`${inputCls} w-20`}
          type="number" min={1} max={90}
          value={form.sla_working_days} onChange={set('sla_working_days')}
        />
      </div>
      <div>
        <label className={labelCls}>
          Reply template{' '}
          <span className="font-normal text-slate-400 normal-case">
            — use <code className="text-xs bg-slate-200 px-1 rounded">{'{name}'}</code> and{' '}
            <code className="text-xs bg-slate-200 px-1 rounded">{'{sla}'}</code> as placeholders
          </span>
        </label>
        <textarea
          className={`${inputCls} resize-vertical min-h-[88px] font-[inherit]`}
          value={form.reply_template} onChange={set('reply_template')}
          placeholder={DEFAULT_TEMPLATE_HINT}
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

export default function DepartmentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: departments, isLoading } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post('/departments', {
      name: f.name.trim(), email: f.email.trim(),
      reply_template: f.reply_template.trim() || null,
      sla_working_days: parseInt(f.sla_working_days) || 3,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setShowCreate(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) => api.patch(`/departments/${id}`, {
      name: f.name.trim(), email: f.email.trim(),
      reply_template: f.reply_template.trim() || null,
      sla_working_days: parseInt(f.sla_working_days) || 3,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return <p className="text-sm text-red-500 p-8">Access denied — admin only.</p>
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Departments</h1>
          <p className="text-sm text-slate-500">
            Route inbox messages to specialist departments. Each gets its own reply template.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Department
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New Department</p>
          <DeptForm
            initial={EMPTY}
            onSave={f => createMutation.mutate(f)}
            onCancel={() => setShowCreate(false)}
            isPending={createMutation.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && departments?.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No departments yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to start routing inbox messages.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {departments?.map(dept => (
          <div key={dept.id}>
            {editingId === dept.id ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Edit {dept.name}</p>
                <DeptForm
                  initial={{
                    name: dept.name, email: dept.email,
                    reply_template: dept.reply_template ?? '',
                    sla_working_days: String(dept.sla_working_days),
                  }}
                  onSave={f => updateMutation.mutate({ id: dept.id, f })}
                  onCancel={() => setEditingId(null)}
                  isPending={updateMutation.isPending}
                />
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-bold text-slate-900">{dept.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                      {dept.sla_working_days}d SLA
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-0.5">{dept.email}</p>
                  <p className="text-xs text-slate-400 italic">
                    {dept.reply_template ? 'Custom template set' : 'Using default template'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => setEditingId(dept.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${dept.name}"?`)) deleteMutation.mutate(dept.id) }}
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
