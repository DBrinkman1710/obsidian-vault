import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, User, Building2, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { TableSkeleton, CardListSkeleton } from '../../../shell/Skeleton'
import { LabelChip, fetchLabels, type ContactLabel } from '../components/LabelChip'
import { fetchCompanies, type Company } from '../components/CompanyBadge'

type Tab = 'companies' | 'contacts'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: { id: string; name: string } | null
  phone: string | null
  labels: ContactLabel[]
}

interface FormState { name: string; domain: string; notes: string }
const EMPTY: FormState = { name: '', domain: '', notes: '' }
const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function errDetail(e: unknown) {
  const d = (e as any)?.response?.data?.detail
  return typeof d === 'string' ? d : 'Something went wrong.'
}

function CompanyForm({ initial, onSave, onCancel, isPending, serverError }: {
  initial: FormState; onSave: (f: FormState) => void; onCancel: () => void
  isPending: boolean; serverError: string | null
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <form onSubmit={ev => { ev.preventDefault(); if (!form.name.trim()) { setError('Name is required'); return } setError(''); onSave(form) }}
      className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4 mb-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Company name *</label>
          <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Acme BV" maxLength={255} autoFocus />
        </div>
        <div>
          <label className={labelCls}>Domain</label>
          <input className={inputCls} value={form.domain} onChange={set('domain')} placeholder="acme.nl" maxLength={255} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`} value={form.notes} onChange={set('notes')} placeholder="Any context…" />
      </div>
      {(error || serverError) && <p className="text-sm text-red-500">{error || serverError}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={isPending}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function CompaniesTab({ onOpenCompany, triggerCreate, onCreateHandled }: {
  onOpenCompany: (id: string) => void
  triggerCreate: boolean
  onCreateHandled: () => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => { if (triggerCreate) { setShowCreate(true); onCreateHandled() } }, [triggerCreate])

  const { data: companies, isLoading } = useQuery<Company[]>({ queryKey: ['companies'], queryFn: fetchCompanies })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['contacts'] }) }
  const toPayload = (f: FormState) => ({ name: f.name.trim(), domain: f.domain.trim() || null, notes: f.notes.trim() || null })

  const createMutation = useMutation({ mutationFn: (f: FormState) => api.post('/contacts/companies', toPayload(f)), onSuccess: () => { invalidate(); setShowCreate(false) } })
  const updateMutation = useMutation({ mutationFn: ({ id, f }: { id: string; f: FormState }) => api.patch(`/contacts/companies/${id}`, toPayload(f)), onSuccess: () => { invalidate(); setEditingId(null) } })
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/contacts/companies/${id}`), onSuccess: invalidate })

  if (isLoading) return <CardListSkeleton rows={5} />

  return (
    <div>
      {showCreate && (
        <CompanyForm initial={EMPTY} onSave={f => createMutation.mutate(f)} onCancel={() => { setShowCreate(false); createMutation.reset() }}
          isPending={createMutation.isPending} serverError={createMutation.isError ? errDetail(createMutation.error) : null} />
      )}

      <div className="flex flex-col gap-3">
        {companies?.map(company => (
          <div key={company.id}>
            {editingId === company.id ? (
              <CompanyForm
                initial={{ name: company.name, domain: company.domain ?? '', notes: company.notes ?? '' }}
                onSave={f => updateMutation.mutate({ id: company.id, f })}
                onCancel={() => { setEditingId(null); updateMutation.reset() }}
                isPending={updateMutation.isPending}
                serverError={updateMutation.isError ? errDetail(updateMutation.error) : null}
              />
            ) : (
              <div
                onClick={() => onOpenCompany(company.id)}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Building2 size={15} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-slate-800 block truncate">{company.name}</span>
                  {company.domain && <span className="text-xs text-slate-400">{company.domain}</span>}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap mr-2">
                  {company.contact_count} contact{company.contact_count !== 1 ? 's' : ''}
                </span>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(company.id); setShowCreate(false) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${company.name}"? Contacts will remain without a company.`)) deleteMutation.mutate(company.id) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {companies?.length === 0 && !showCreate && (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
            <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No companies yet</p>
            {isAdmin && <p className="text-xs text-slate-400 mt-1">Create one to group your contacts.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function ContactsTab({ initialCompanyFilter }: { initialCompanyFilter: string | null }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(initialCompanyFilter)

  const { data: labels } = useQuery({ queryKey: ['contact-labels'], queryFn: fetchLabels })
  const { data: companies } = useQuery<Company[]>({ queryKey: ['companies'], queryFn: fetchCompanies })
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, labelFilter, companyFilter],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', {
      params: { search: search || undefined, label_id: labelFilter || undefined, company_id: companyFilter || undefined },
    }).then(r => r.data),
  })

  return (
    <div>
      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search by name, email, or company…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {labels && labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <button onClick={() => setLabelFilter(null)}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${labelFilter === null ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}>
            All
          </button>
          {labels.map(label => (
            <LabelChip key={label.id} label={label} selected={labelFilter === label.id}
              onClick={() => setLabelFilter(labelFilter === label.id ? null : label.id)} />
          ))}
        </div>
      )}

      {companies && companies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <button onClick={() => setCompanyFilter(null)}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${companyFilter === null ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}>
            All companies
          </button>
          {companies.map(company => (
            <button key={company.id} onClick={() => setCompanyFilter(companyFilter === company.id ? null : company.id)}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${companyFilter === company.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}>
              {company.name}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Company</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Labels</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Phone</th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton cols={5} />
          ) : (
            <tbody className="divide-y divide-slate-100">
              {data?.items.map(c => (
                <tr key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <User size={13} className="text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-600">{c.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.company ? (
                      <span onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setCompanyFilter(companyFilter === c.company!.id ? null : c.company!.id)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${companyFilter === c.company!.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                          <Building2 size={10} />{c.company.name}
                        </button>
                      </span>
                    ) : <span className="text-sm text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.labels.length === 0 ? <span className="text-sm text-slate-400">—</span> : (
                      <div className="flex flex-wrap gap-1">
                        {c.labels.slice(0, 3).map(label => <LabelChip key={label.id} label={label} />)}
                        {c.labels.length > 3 && <span className="text-xs text-slate-400 self-center">+{c.labels.length - 3}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {!isLoading && data?.items.length === 0 && (
          <div className="py-12 text-center">
            <User size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No contacts found</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ContactsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [activeTab, setActiveTab] = useState<Tab>('companies')
  const [pendingCompanyFilter, setPendingCompanyFilter] = useState<string | null>(null)
  const [triggerCreate, setTriggerCreate] = useState(false)

  function openCompany(id: string) {
    setPendingCompanyFilter(id)
    setActiveTab('contacts')
  }

  function handleNewCompany() {
    setActiveTab('companies')
    setTriggerCreate(true)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Fixed header */}
      <div className="shrink-0 px-8 pt-8 pb-0 bg-slate-50">
        <div className="flex items-start justify-between mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={handleNewCompany}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Plus size={15} strokeWidth={2.5} />
                New Company
              </button>
            )}
            <Link
              to="/contacts/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={15} strokeWidth={2.5} />
              New Contact
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-0">
          {(['companies', 'contacts'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === 'companies' && (
          <CompaniesTab
            onOpenCompany={openCompany}
            triggerCreate={triggerCreate}
            onCreateHandled={() => setTriggerCreate(false)}
          />
        )}
        {activeTab === 'contacts' && (
          <ContactsTab
            key={pendingCompanyFilter ?? 'all'}
            initialCompanyFilter={pendingCompanyFilter}
          />
        )}
      </div>
    </div>
  )
}
