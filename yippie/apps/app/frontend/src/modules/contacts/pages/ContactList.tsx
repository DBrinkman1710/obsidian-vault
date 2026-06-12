import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, User, ChevronLeft, Upload, Download, Trash2, X, Mail } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { TableSkeleton } from '../../../shell/Skeleton'
import { LabelChip, fetchLabels, type ContactLabel } from '../components/LabelChip'
import { CompanyBadge, fetchCompanies, type CompanyRef } from '../components/CompanyBadge'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: CompanyRef | null
  phone: string | null
  labels: ContactLabel[]
  created_at: string
}

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
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function ContactList() {
  const navigate = useNavigate()
  const { companyId } = useParams<{ companyId?: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(companyId ?? null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: labels } = useQuery({ queryKey: ['contact-labels'], queryFn: fetchLabels })
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies })
  const scopedCompany = companyId ? companies?.find(c => c.id === companyId) : null

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, labelFilter, companyFilter],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', {
      params: {
        search: search || undefined,
        label_id: labelFilter || undefined,
        company_id: companyFilter || undefined,
      },
    }).then(r => r.data),
  })

  const items = data?.items ?? []
  const allSelected = items.length > 0 && items.every(c => selected.has(c.id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map(c => c.id)))
  }
  function clearSelection() {
    setSelected(new Set())
  }

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post<ImportResult>('/contacts/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data)
    },
    onSuccess: (result) => {
      setImportResult(result)
      setImportError(null)
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
    onError: (err: any) => {
      setImportResult(null)
      setImportError(err?.response?.data?.detail ?? 'Import failed')
    },
  })

  async function exportContacts(ids?: string[]) {
    const params: Record<string, string> = {}
    if (ids && ids.length) params.ids = ids.join(',')
    else if (search) params.search = search
    const res = await api.get('/contacts/export', { params, responseType: 'blob' })
    downloadBlob(res.data, 'contacts.csv', 'text/csv')
  }

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => api.delete(`/contacts/${id}`)))
    },
    onSuccess: () => {
      clearSelection()
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) importMutation.mutate(file)
    e.target.value = ''
  }

  function closeImport() {
    setShowImport(false)
    setImportResult(null)
    setImportError(null)
  }

  const selectedIds = [...selected]

  return (
    <div>
      <div className="mb-6">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-3 transition-colors">
          <ChevronLeft size={13} />
          Companies
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {scopedCompany ? scopedCompany.name : 'All Contacts'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} contact{(data?.total ?? 0) !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportContacts()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
            >
              <Download size={15} strokeWidth={2.5} />
              Export
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
              >
                <Upload size={15} strokeWidth={2.5} />
                Import
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
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search by name, email, or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {labels && labels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <button
            type="button"
            onClick={() => setLabelFilter(null)}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
              labelFilter === null
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
            }`}
          >
            All
          </button>
          {labels.map(label => (
            <LabelChip
              key={label.id}
              label={label}
              selected={labelFilter === label.id}
              onClick={() => setLabelFilter(labelFilter === label.id ? null : label.id)}
            />
          ))}
        </div>
      )}

      {companies && companies.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <button
            type="button"
            onClick={() => setCompanyFilter(null)}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-colors ${
              companyFilter === null
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
            }`}
          >
            All companies
          </button>
          {companies.map(company => (
            <CompanyBadge
              key={company.id}
              name={company.name}
              selected={companyFilter === company.id}
              onClick={() => setCompanyFilter(companyFilter === company.id ? null : company.id)}
            />
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-900">{selected.size} selected</span>
          <div className="h-4 w-px bg-blue-200" />
          <button
            onClick={() => exportContacts(selectedIds)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <Download size={14} strokeWidth={2.5} />
            Export selected
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${selected.size} contact(s)? This cannot be undone.`)) {
                deleteMutation.mutate(selectedIds)
              }
            }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            <Trash2 size={14} strokeWidth={2.5} />
            Delete selected
          </button>
          <button
            onClick={() => alert('Compose from contacts — feature coming')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <Mail size={14} strokeWidth={2.5} />
            Compose
          </button>
          <button onClick={clearSelection} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
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
              {items.map(c => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User size={13} className="text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {c.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.company ? (
                      // stopPropagation so the badge filters instead of opening the row
                      <span onClick={e => e.stopPropagation()}>
                        <CompanyBadge
                          name={c.company.name}
                          selected={companyFilter === c.company.id}
                          onClick={() => setCompanyFilter(companyFilter === c.company!.id ? null : c.company!.id)}
                        />
                      </span>
                    ) : (
                      <span className="text-sm text-slate-600 cursor-pointer block" onClick={() => navigate(`/contacts/${c.id}`)}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>
                    {c.labels.length === 0 ? (
                      <span className="text-sm text-slate-600">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.labels.slice(0, 3).map(label => <LabelChip key={label.id} label={label} />)}
                        {c.labels.length > 3 && (
                          <span className="text-xs text-slate-400 self-center">+{c.labels.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 cursor-pointer" onClick={() => navigate(`/contacts/${c.id}`)}>{c.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {!isLoading && items.length === 0 && (
          <div className="py-12 text-center">
            <User size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No contacts found</p>
          </div>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-900">Import contacts</h2>
              <button onClick={closeImport} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-5">Upload a CSV, JSON, or XLSX file.</p>

            {!importResult ? (
              <>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
                  <p className="text-xs text-slate-500 mb-2">
                    Columns: <span className="font-mono text-slate-700">full_name*</span>, email, phone, company, notes
                  </p>
                  <button
                    onClick={() => downloadBlob(TEMPLATE_CSV, 'contacts-template.csv', 'text/csv')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                  >
                    <Download size={12} strokeWidth={2.5} />
                    Download template
                  </button>
                </div>

                {importError && (
                  <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {importError}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.json,.xlsx"
                  onChange={handleFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={importMutation.isPending}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  <Upload size={15} strokeWidth={2.5} />
                  {importMutation.isPending ? 'Importing…' : 'Choose file'}
                </button>
              </>
            ) : (
              <>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 text-sm text-slate-700">
                  <span className="font-semibold text-green-700">{importResult.imported} imported</span>
                  {', '}
                  <span className="font-semibold text-amber-700">{importResult.skipped} skipped (duplicates)</span>
                  {', '}
                  <span className="font-semibold text-red-700">{importResult.errors} error{importResult.errors === 1 ? '' : 's'}</span>
                </div>
                {importResult.error_details.length > 0 && (
                  <ul className="mb-4 max-h-40 overflow-y-auto text-xs text-red-600 list-disc pl-5 space-y-0.5">
                    {importResult.error_details.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
                <button
                  onClick={closeImport}
                  className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
