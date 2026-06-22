import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { CompanyBadge, fetchCompanies, type Company } from '../../contacts/components/CompanyBadge'

interface FormState {
  name: string
  domain: string
  notes: string
}

const EMPTY: FormState = { name: '', domain: '', notes: '' }

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function errorDetail(err: unknown): string {
  const detail = (err as any)?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Something went wrong — try again.'
}

function CompanyForm({ initial, onSave, onCancel, isPending, serverError }: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  isPending: boolean
  serverError: string | null
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState('')

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Company name *</label>
          <input
            className={inputCls} value={form.name} onChange={set('name')}
            placeholder="Acme BV" maxLength={255} autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>Domain</label>
          <input
            className={inputCls} value={form.domain} onChange={set('domain')}
            placeholder="acme.nl" maxLength={255}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`}
          value={form.notes} onChange={set('notes')}
          placeholder="Any context about this company…"
        />
      </div>
      {(error || serverError) && <p className="text-sm text-red-500">{error || serverError}</p>}
      <div className="flex gap-3">
        <button
          type="submit" disabled={isPending}
          className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
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

export default function CompaniesPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['companies'] })
    qc.invalidateQueries({ queryKey: ['contacts'] })
  }

  const toPayload = (f: FormState) => ({
    name: f.name.trim(),
    domain: f.domain.trim() || null,
    notes: f.notes.trim() || null,
  })

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post('/contacts/companies', toPayload(f)),
    onSuccess: () => { invalidate(); setShowCreate(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, f }: { id: string; f: FormState }) =>
      api.patch(`/contacts/companies/${id}`, toPayload(f)),
    onSuccess: () => { invalidate(); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/companies/${id}`),
    onSuccess: invalidate,
  })

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return <p className="text-sm text-red-500 p-8">Access denied — admin only.</p>
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Companies</h1>
          <p className="text-sm text-slate-500">
            Group contacts under the company they work for — filter the contact list and email everyone at once.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Company
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New Company</p>
          <CompanyForm
            initial={EMPTY}
            onSave={f => createMutation.mutate(f)}
            onCancel={() => { setShowCreate(false); createMutation.reset() }}
            isPending={createMutation.isPending}
            serverError={createMutation.isError ? errorDetail(createMutation.error) : null}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && companies?.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No companies yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to start grouping your contacts.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {companies?.map(company => (
          <div key={company.id}>
            {editingId === company.id ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Edit {company.name}</p>
                <CompanyForm
                  initial={{ name: company.name, domain: company.domain ?? '', notes: company.notes ?? '' }}
                  onSave={f => updateMutation.mutate({ id: company.id, f })}
                  onCancel={() => { setEditingId(null); updateMutation.reset() }}
                  isPending={updateMutation.isPending}
                  serverError={updateMutation.isError ? errorDetail(updateMutation.error) : null}
                />
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyBadge name={company.name} />
                  {company.domain && <span className="text-xs text-slate-400 truncate">{company.domain}</span>}
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {company.contact_count} contact{company.contact_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => { setEditingId(company.id); setShowCreate(false) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${company.name}"? Its contacts will keep existing without a company.`)) deleteMutation.mutate(company.id) }}
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
