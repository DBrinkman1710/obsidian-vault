import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCompose } from '../../../hooks/useCompose'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, User, ChevronLeft, Upload, Download, Trash2, Mail } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { TableSkeleton } from '../../../shell/Skeleton'
import { LabelChip, fetchLabels, type ContactLabel } from '../components/LabelChip'
import { CompanyBadge, fetchCompanies, type CompanyRef } from '../components/CompanyBadge'
import { useSelection, Checkbox, BulkBar } from '../../../components/Selection'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { useT } from '../../../hooks/useT'
import { CloseButton } from '../../../shell/CloseButton'

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

const TEMPLATE_CSV = 'full_name,email,phone,company,notes\nAlex Johnson,alex@example.com,+1 555 012 3456,Acme Ltd,VIP customer\n'

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
  const t = useT()
  const navigate = useNavigate()
  const { openCompose } = useCompose()
  const { companyId } = useParams<{ companyId?: string }>()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(companyId ?? null)
  // Smart default: carry the active company into the new-contact form so it's
  // pre-filled when the user is already looking at one company's contacts.
  const newContactHref = companyFilter ? `/contacts/new?company=${companyFilter}` : '/contacts/new'
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: labels } = useQuery({ queryKey: ['contact-labels'], queryFn: fetchLabels })
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies })
  const scopedCompany = companyId ? companies?.find((c: any) => c.id === companyId) : null

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, labelFilter, companyFilter],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', {
      params: {
        search: search || undefined,
        label_id: labelFilter || undefined,
        company_id: companyFilter || undefined,
      },
    }).then((r: any) => r.data),
  })

  const items = data?.items ?? []
  const ids = items.map((c: any) => c.id)
  const selection = useSelection(ids)
  const ctx = useContextMenu()

  function clearSelection() { selection.clear() }

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return api.post<ImportResult>('/contacts/import', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r: any) => r.data)
    },
    onSuccess: (result: any) => {
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

  return (
    <div>
      <div className="mb-6">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-3 transition-colors">
          <ChevronLeft size={13} />
          Companies
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-xl text-slate-900">
              {scopedCompany ? scopedCompany.name : t('contacts_all')}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} contact{(data?.total ?? 0) !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportContacts()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
            >
              <Download size={15} strokeWidth={2.5} />
              {t('contacts_export_btn')}
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
              >
                <Upload size={15} strokeWidth={2.5} />
                {t('contacts_import_btn')}
              </button>
            )}
            <Link
              to={newContactHref}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              <Plus size={15} strokeWidth={2.5} />
              {t('contacts_new_btn')}
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder={t('contacts_search_ph')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
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
            {t('filter_all')}
          </button>
          {labels.map((label: any) => (
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
            {t('contacts_all_companies')}
          </button>
          {companies.map((company: any) => (
            <CompanyBadge
              key={company.id}
              name={company.name}
              selected={companyFilter === company.id}
              onClick={() => setCompanyFilter(companyFilter === company.id ? null : company.id)}
            />
          ))}
        </div>
      )}

      <BulkBar
        count={selection.count}
        onClear={selection.clear}
        actions={[
          {
            label: t('contacts_export_btn'),
            icon: <Download size={13} />,
            onClick: () => exportContacts([...selection.sel]),
          },
          {
            label: t('delete'),
            icon: <Trash2 size={13} />,
            danger: true,
            onClick: () => {
              if (confirm(`${t('delete')} ${selection.count} contact(s)? ${t('confirm_cannot_undo')}`))
                deleteMutation.mutate([...selection.sel])
            },
          },
        ]}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 w-10 text-left">
                <Checkbox
                  checked={selection.all}
                  indeterminate={selection.some}
                  onChange={selection.toggleAll}
                  ariaLabel="Select all contacts"
                />
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('contacts_col_name')}</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('contacts_col_email')}</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('contacts_col_company')}</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('contacts_col_labels')}</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('contacts_col_phone')}</th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton cols={5} />
          ) : (
            <tbody className="divide-y divide-slate-100">
              {items.map((c: any) => (
                <tr
                  key={c.id}
                  className="transition-colors"
                  style={{ background: selection.has(c.id) ? 'rgba(91,164,245,0.08)' : undefined }}
                  onContextMenu={e => ctx.open(e, [
                    { header: c.full_name },
                    { label: t('contacts_view'), icon: <User size={14} />, onClick: () => navigate(`/contacts/${c.id}`) },
                    ...(c.email ? [{ label: t('contacts_send_email'), icon: <Mail size={14} />, onClick: () => openCompose({ recipients: [{ email: c.email!, label: c.full_name || c.email! }], subject: '', body: '', fromEmail: null }) }] : []),
                    { separator: true },
                    { label: t('contacts_export_btn'), icon: <Download size={14} />, onClick: () => exportContacts([c.id]) },
                    {
                      label: t('delete'),
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onClick: () => {
                        if (confirm(t('contacts_delete_one')))
                          deleteMutation.mutate([c.id])
                      },
                    },
                  ])}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.has(c.id)}
                      onChange={e => selection.toggle(c.id, e)}
                      ariaLabel={`Select ${c.full_name}`}
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
                        {c.labels.slice(0, 3).map((label: any) => <LabelChip key={label.id} label={label} />)}
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
            <p className="text-sm text-slate-400 font-medium mb-4">{t('contacts_empty')}</p>
            <Link
              to={newContactHref}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              <Plus size={14} strokeWidth={2.5} />
              {t('contacts_add_first')}
            </Link>
          </div>
        )}
      </div>

      <ContextMenu state={ctx.state} onClose={ctx.close} />

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeImport}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-900">{t('contacts_import_title')}</h2>
              <CloseButton onClick={closeImport} />
            </div>
            <p className="text-sm text-slate-500 mb-5">{t('contacts_import_desc')}</p>

            {!importResult ? (
              <>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4">
                  <p className="text-xs text-slate-500 mb-2">
                    {t('contacts_import_cols')} <span className="font-mono text-slate-700">full_name*</span>, email, phone, company, notes
                  </p>
                  <button
                    onClick={() => downloadBlob(TEMPLATE_CSV, 'contacts-template.csv', 'text/csv')}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                  >
                    <Download size={12} strokeWidth={2.5} />
                    {t('contacts_download_tpl')}
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50"
                >
                  <Upload size={15} strokeWidth={2.5} />
                  {importMutation.isPending ? t('contacts_importing') : t('contacts_choose_file')}
                </button>
              </>
            ) : (
              <>
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-4 text-sm text-slate-700">
                  <span className="font-semibold text-green-700">{importResult.imported} {t('contacts_imported')}</span>
                  {', '}
                  <span className="font-semibold text-amber-700">{importResult.skipped} {t('contacts_skipped')}</span>
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
                  className="w-full px-4 py-2.5 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
                >
                  {t('done')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
