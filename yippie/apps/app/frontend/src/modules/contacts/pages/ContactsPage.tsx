import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, User, Building2, Pencil, Trash2, Upload, Download, X, Mail } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { TableSkeleton, CardListSkeleton } from '../../../shell/Skeleton'
import { LabelChip, fetchLabels, type ContactLabel } from '../components/LabelChip'
import { fetchCompanies, type Company } from '../components/CompanyBadge'
import { ColumnPicker, resolveColumns } from '../components/ColumnPicker'
import type { ContactColumnPref } from '../../../auth/useAuth'

interface ImportResult {
  imported: number
  skipped: number
  errors: number
  error_details: string[]
}

const TEMPLATE_CSV = 'full_name,email,phone,company,notes\nJan de Vries,jan@example.nl,+31612345678,Acme BV,VIP customer\n'

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

type Tab = 'companies' | 'contacts' | 'trash'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: { id: string; name: string } | null
  phone: string | null
  labels: ContactLabel[]
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
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
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
          Cancel
        </button>
      </div>
    </form>
  )
}

function CompaniesTab({ triggerCreate, onCreateHandled }: {
  triggerCreate: boolean
  onCreateHandled: () => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => { if (triggerCreate) { setShowCreate(true); onCreateHandled() } }, [triggerCreate])

  const { data: companies, isLoading } = useQuery<Company[]>({ queryKey: ['companies'], queryFn: fetchCompanies })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['contacts'] }) }
  const toPayload = (f: FormState) => ({ name: f.name.trim(), domain: f.domain.trim() || null, notes: f.notes.trim() || null })

  const createMutation = useMutation({ mutationFn: (f: FormState) => api.post('/contacts/companies', toPayload(f)), onSuccess: () => { invalidate(); setShowCreate(false) } })
  const updateMutation = useMutation({ mutationFn: ({ id, f }: { id: string; f: FormState }) => api.patch(`/contacts/companies/${id}`, toPayload(f)), onSuccess: () => { invalidate(); setEditingId(null) } })
  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => api.delete(`/contacts/companies/${id}`))),
    onSuccess: () => { invalidate(); setSelected(new Set()) },
  })

  const displayed = search
    ? (companies ?? []).filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : (companies ?? [])

  const allSelected = displayed.length > 0 && displayed.every(c => selected.has(c.id))
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(displayed.map(c => c.id))) }
  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function exportSelectedCsv() {
    const rows = (companies ?? []).filter(c => selected.has(c.id))
    const header = 'name,domain,contact_count,notes'
    const lines = rows.map(c => [c.name, c.domain ?? '', String(c.contact_count), ''].map(v => `"${v.replace(/"/g, '""')}"`).join(','))
    downloadBlob([header, ...lines].join('\n'), 'companies.csv', 'text/csv')
  }

  if (isLoading) return <CardListSkeleton rows={5} />

  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Filter companies…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {showCreate && (
        <CompanyForm initial={EMPTY} onSave={f => createMutation.mutate(f)} onCancel={() => { setShowCreate(false); createMutation.reset() }}
          isPending={createMutation.isPending} serverError={createMutation.isError ? errDetail(createMutation.error) : null} />
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-900">{selected.size} selected</span>
          <div className="h-4 w-px bg-blue-200" />
          <button onClick={exportSelectedCsv}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900">
            <Download size={14} strokeWidth={2.5} /> Export CSV
          </button>
          <button
            onClick={() => { if (confirm(`Delete ${selected.size} company/companies? Contacts will remain.`)) deleteMutation.mutate([...selected]) }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50">
            <Trash2 size={14} strokeWidth={2.5} /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {displayed.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <input type="checkbox" checked={allSelected} onChange={toggleAll}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
          <span className="text-xs text-slate-400">{allSelected ? 'Deselect all' : 'Select all'}</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {displayed.map(company => (
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
              <div className={`bg-white border rounded-xl p-4 flex items-center gap-3 shadow-sm transition-colors ${selected.has(company.id) ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200'}`}>
                <div onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(company.id)} onChange={() => toggle(company.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </div>
                <div className="flex flex-1 min-w-0 items-center gap-3">
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
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => { setEditingId(company.id); setShowCreate(false) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => { if (confirm(`Delete "${company.name}"? Contacts will remain without a company.`)) deleteMutation.mutate([company.id]) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {displayed.length === 0 && !showCreate && (
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

interface EditContactForm { full_name: string; email: string; phone: string; notes: string; company_id: string }

function EditContactModal({ contact, companies, onClose }: {
  contact: Contact; companies: Company[]; onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<EditContactForm>({
    full_name: contact.full_name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    notes: '',
    company_id: contact.company?.id ?? '',
  })
  const [error, setError] = useState('')
  const set = (k: keyof EditContactForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${contact.id}`, {
      full_name: form.full_name.trim() || undefined,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      company_id: form.company_id || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); onClose() },
    onError: () => setError('Failed to save'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Edit contact</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (!form.full_name.trim()) { setError('Name is required'); return } setError(''); mutation.mutate() }}
          className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.full_name} onChange={set('full_name')} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Company</label>
            <select className={inputCls} value={form.company_id} onChange={set('company_id')}>
              <option value="">— No company —</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={mutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ContactsTab() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, refreshUser } = useAuth()
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const columns = resolveColumns(user?.contact_column_prefs)
  const visibleColumns = columns.filter(c => c.visible)

  const prefsMutation = useMutation({
    mutationFn: (prefs: ContactColumnPref[]) =>
      api.patch('/auth/me', { contact_column_prefs: prefs }).then(r => r.data),
    onSuccess: () => { refreshUser() },
  })

  const { data: labels } = useQuery({ queryKey: ['contact-labels'], queryFn: fetchLabels })
  const { data: companies } = useQuery<Company[]>({ queryKey: ['companies'], queryFn: fetchCompanies })
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, labelFilter, companyFilter],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', {
      params: { search: search || undefined, label_id: labelFilter || undefined, company_id: companyFilter || undefined },
    }).then(r => r.data),
  })

  const items = data?.items ?? []
  const allSelected = items.length > 0 && items.every(c => selected.has(c.id))

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(items.map(c => c.id))) }
  function clearSelection() { setSelected(new Set()) }

  async function exportSelected(ids?: string[]) {
    const params: Record<string, string> = {}
    if (ids?.length) params.ids = ids.join(',')
    else if (search) params.search = search
    const res = await api.get('/contacts/export', { params, responseType: 'blob' })
    downloadBlob(res.data, 'contacts.csv', 'text/csv')
  }

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => api.delete(`/contacts/${id}`))),
    onSuccess: () => { clearSelection(); qc.invalidateQueries({ queryKey: ['contacts'] }) },
  })

  const selectedIds = [...selected]

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            placeholder="Search by name, email, or company…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="ml-auto">
          <ColumnPicker value={columns} onChange={prefs => prefsMutation.mutate(prefs)} saving={prefsMutation.isPending} />
        </div>
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

      {companyFilter && companies && (
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-xs text-slate-500 font-medium">Company:</span>
          <button
            onClick={() => setCompanyFilter(null)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
            <Building2 size={10} />
            {companies.find(co => co.id === companyFilter)?.name ?? 'Company'}
            <X size={10} className="ml-0.5" />
          </button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-900">{selected.size} selected</span>
          <div className="h-4 w-px bg-blue-200" />
          <button onClick={() => alert('Compose from contacts — coming soon')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
            <Mail size={14} strokeWidth={2.5} /> Compose
          </button>
          <button onClick={() => exportSelected(selectedIds)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900">
            <Download size={14} strokeWidth={2.5} /> Export selected
          </button>
          <button
            onClick={() => { if (confirm(`Delete ${selected.size} contact(s)? This cannot be undone.`)) deleteMutation.mutate(selectedIds) }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50">
            <Trash2 size={14} strokeWidth={2.5} /> Delete selected
          </button>
          <button onClick={clearSelection} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10 text-left">
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              </th>
              {visibleColumns.map(col => (
                <th key={col.key}
                  className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left ${col.key === 'name' || col.key === 'email' ? '' : 'hidden md:table-cell'}`}>
                  {col.label}
                </th>
              ))}
              <th className="hidden md:table-cell px-4 py-3 w-10"></th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton cols={visibleColumns.length + 2} />
          ) : (
            <tbody className="divide-y divide-slate-100">
              {items.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                  </td>
                  {visibleColumns.map(col => {
                    const responsive = col.key === 'name' || col.key === 'email' ? '' : 'hidden md:table-cell'
                    if (col.key === 'name') return (
                      <td key={col.key} className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <User size={13} className="text-blue-600" />
                          </div>
                          <span className="text-sm font-medium text-blue-600">{c.full_name}</span>
                        </div>
                      </td>
                    )
                    if (col.key === 'email') return (
                      <td key={col.key} className="px-4 py-3 text-sm text-slate-600 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>{c.email ?? '—'}</td>
                    )
                    if (col.key === 'company') return (
                      <td key={col.key} className={`${responsive} px-4 py-3 cursor-pointer`} onClick={() => navigate(`/contacts/${c.id}`)}>
                        {c.company ? (
                          <span
                            onClick={e => { e.stopPropagation(); setCompanyFilter(companyFilter === c.company!.id ? null : c.company!.id) }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors cursor-pointer"
                            title={`Filter by ${c.company.name}`}>
                            <Building2 size={10} />{c.company.name}
                          </span>
                        ) : <span className="text-sm text-slate-400">—</span>}
                      </td>
                    )
                    if (col.key === 'labels') return (
                      <td key={col.key} className={`${responsive} px-4 py-3 cursor-pointer`} onClick={() => navigate(`/contacts/${c.id}`)}>
                        {c.labels.length === 0 ? <span className="text-sm text-slate-400">—</span> : (
                          <div className="flex flex-wrap gap-1">
                            {c.labels.slice(0, 3).map(label => <LabelChip key={label.id} label={label} />)}
                            {c.labels.length > 3 && <span className="text-xs text-slate-400 self-center">+{c.labels.length - 3}</span>}
                          </div>
                        )}
                      </td>
                    )
                    if (col.key === 'phone') return (
                      <td key={col.key} className={`${responsive} px-4 py-3 text-sm text-slate-600 cursor-pointer`} onClick={() => navigate(`/contacts/${c.id}`)}>{c.phone ?? '—'}</td>
                    )
                    if (col.key === 'notes') return (
                      <td key={col.key} className={`${responsive} px-4 py-3 text-sm text-slate-600 cursor-pointer`} onClick={() => navigate(`/contacts/${c.id}`)} title={c.notes ?? undefined}>
                        {c.notes ? (c.notes.length > 40 ? `${c.notes.slice(0, 40)}…` : c.notes) : '—'}
                      </td>
                    )
                    if (col.key === 'created_at') return (
                      <td key={col.key} className={`${responsive} px-4 py-3 text-sm text-slate-600 cursor-pointer`} onClick={() => navigate(`/contacts/${c.id}`)}>{c.created_at ? new Date(c.created_at).toLocaleDateString('nl-NL') : '—'}</td>
                    )
                    if (col.key === 'updated_at') return (
                      <td key={col.key} className={`${responsive} px-4 py-3 text-sm text-slate-600 cursor-pointer`} onClick={() => navigate(`/contacts/${c.id}`)}>{c.updated_at ? new Date(c.updated_at).toLocaleDateString('nl-NL') : '—'}</td>
                    )
                    return null
                  })}
                  <td className="hidden md:table-cell px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditingContact(c)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors" title="Edit">
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        </div>
        {!isLoading && items.length === 0 && (
          <div className="py-12 text-center">
            <User size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No contacts found</p>
          </div>
        )}
      </div>
      {editingContact && (
        <EditContactModal
          contact={editingContact}
          companies={companies ?? []}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  )
}

function TrashTab() {
  const qc = useQueryClient()
  const { data: trashed, isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts-trash'],
    queryFn: () => api.get<Contact[]>('/contacts/trash').then(r => r.data),
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post(`/contacts/${id}/restore`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contacts-trash'] })
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}/permanent`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts-trash'] }),
  })

  function handlePermanentDelete(c: Contact) {
    if (!confirm(`Permanently delete "${c.full_name}"? This cannot be undone.`)) return
    permanentDeleteMutation.mutate(c.id)
  }

  if (isLoading) return <TableSkeleton cols={4} />

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Deleted on</th>
              <th className="px-4 py-3 w-36"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(trashed ?? []).map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User size={13} className="text-slate-400" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{c.full_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {c.deleted_at ? new Date(c.deleted_at).toLocaleDateString('nl-NL') : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => restoreMutation.mutate(c.id)}
                      disabled={restoreMutation.isPending || permanentDeleteMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(c)}
                      disabled={restoreMutation.isPending || permanentDeleteMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Delete permanently
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && (trashed ?? []).length === 0 && (
        <div className="py-12 text-center">
          <Trash2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">Trash is empty</p>
        </div>
      )}
    </div>
  )
}

const IMPORT_TARGET_FIELDS: { value: string; label: string }[] = [
  { value: 'full_name', label: 'Full name *' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'company', label: 'Company' },
  { value: 'notes', label: 'Notes' },
]

interface ImportPreview { headers: string[]; preview_rows: Record<string, unknown>[] }

const normalizeHeader = (h: string) => h.toLowerCase().replace(/[\s_]/g, '')

function autoMap(headers: string[]): Record<string, string> {
  const fieldByNorm = new Map(IMPORT_TARGET_FIELDS.map(f => [normalizeHeader(f.value), f.value]))
  // Common aliases that don't match the field name verbatim.
  const aliases: Record<string, string> = { name: 'full_name', fullname: 'full_name', company: 'company', organisation: 'company', organization: 'company', tel: 'phone', telephone: 'phone', mobile: 'phone', note: 'notes' }
  const mapping: Record<string, string> = {}
  for (const h of headers) {
    const norm = normalizeHeader(h)
    mapping[h] = fieldByNorm.get(norm) ?? aliases[norm] ?? ''
  }
  return mapping
}

export default function ContactsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [activeTab, setActiveTab] = useState<Tab>('contacts')
  const [triggerCreate, setTriggerCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const previewMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post<ImportPreview>('/contacts/import/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: (data) => { setPreview(data); setMapping(autoMap(data.headers)); setImportError(null) },
    onError: (err: any) => { setImportError(err?.response?.data?.detail ?? 'Could not read file') },
  })

  const importMutation = useMutation({
    mutationFn: ({ file, map }: { file: File; map: Record<string, string> }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('column_mapping', JSON.stringify(map))
      return api.post<ImportResult>('/contacts/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
    },
    onSuccess: (result) => { setImportResult(result); setImportError(null); qc.invalidateQueries({ queryKey: ['contacts'] }) },
    onError: (err: any) => { setImportResult(null); setImportError(err?.response?.data?.detail ?? 'Import failed') },
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { setPendingFile(file); previewMutation.mutate(file) }
    e.target.value = ''
  }

  const mappedToFullName = Object.values(mapping).includes('full_name')

  function runImport() {
    if (!pendingFile) return
    // Drop "— skip —" columns from the mapping before sending.
    const map = Object.fromEntries(Object.entries(mapping).filter(([, v]) => v))
    importMutation.mutate({ file: pendingFile, map })
  }

  function closeImport() {
    setShowImport(false); setImportResult(null); setImportError(null)
    setPendingFile(null); setPreview(null); setMapping({})
    previewMutation.reset(); importMutation.reset()
  }

  async function exportAll() {
    const res = await api.get('/contacts/export', { responseType: 'blob' })
    downloadBlob(res.data, 'contacts.csv', 'text/csv')
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
            <button onClick={exportAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
              <Download size={15} strokeWidth={2.5} /> Export
            </button>
            {isAdmin && (
              <button onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
                <Upload size={15} strokeWidth={2.5} /> Import
              </button>
            )}
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
          {isAdmin && (
            <button
              onClick={() => setActiveTab('trash')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === 'trash'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Trash
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === 'companies' && (
          <CompaniesTab
            triggerCreate={triggerCreate}
            onCreateHandled={() => setTriggerCreate(false)}
          />
        )}
        {activeTab === 'contacts' && (
          <ContactsTab />
        )}
        {activeTab === 'trash' && (
          <TrashTab />
        )}
      </div>

      <input ref={fileRef} type="file" accept=".csv,.json,.xlsx" onChange={handleFile} className="hidden" />

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-900">Import contacts</h2>
              <button onClick={closeImport} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-5">Upload a CSV, JSON, or XLSX file.</p>

            {!importResult && !preview ? (
              <>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
                  <p className="text-xs text-slate-500 mb-2">
                    Columns: <span className="font-mono text-slate-700">full_name*</span>, email, phone, company, notes
                  </p>
                  <button onClick={() => downloadBlob(TEMPLATE_CSV, 'contacts-template.csv', 'text/csv')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                    <Download size={12} strokeWidth={2.5} /> Download template
                  </button>
                </div>
                {importError && (
                  <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{importError}</div>
                )}
                <button onClick={() => fileRef.current?.click()} disabled={previewMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  <Upload size={15} strokeWidth={2.5} />
                  {previewMutation.isPending ? 'Reading…' : 'Choose file'}
                </button>
              </>
            ) : !importResult && preview ? (
              <>
                <p className="text-xs text-slate-500 mb-3">Match each column in your file to a Yippie field.</p>
                <div className="max-h-64 overflow-y-auto flex flex-col gap-2 mb-4 pr-1">
                  {preview.headers.map(h => (
                    <div key={h} className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-700" title={h}>{h}</span>
                      <span className="text-slate-300 text-xs">→</span>
                      <select
                        value={mapping[h] ?? ''}
                        onChange={e => setMapping(p => ({ ...p, [h]: e.target.value }))}
                        className="w-40 shrink-0 px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">— skip —</option>
                        {IMPORT_TARGET_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {!mappedToFullName && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    Map one column to <span className="font-semibold">Full name</span> to continue.
                  </div>
                )}
                {importError && (
                  <div className="mb-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{importError}</div>
                )}
                <div className="flex gap-3">
                  <button onClick={runImport} disabled={!mappedToFullName || importMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
                    <Upload size={15} strokeWidth={2.5} />
                    {importMutation.isPending ? 'Importing…' : 'Import'}
                  </button>
                  <button onClick={() => { setPreview(null); setPendingFile(null); setImportError(null); previewMutation.reset() }}
                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                    Back
                  </button>
                </div>
              </>
            ) : importResult ? (
              <>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 text-sm text-slate-700">
                  <span className="font-semibold text-green-700">{importResult.imported} imported</span>{', '}
                  <span className="font-semibold text-amber-700">{importResult.skipped} skipped (duplicates)</span>{', '}
                  <span className="font-semibold text-red-700">{importResult.errors} error{importResult.errors === 1 ? '' : 's'}</span>
                </div>
                {importResult.error_details.length > 0 && (
                  <ul className="mb-4 max-h-40 overflow-y-auto text-xs text-red-600 list-disc pl-5 space-y-0.5">
                    {importResult.error_details.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
                <button onClick={closeImport}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  Done
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
