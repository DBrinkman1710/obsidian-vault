import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { CompanyBadge, fetchCompanies, type Company } from '../../contacts/components/CompanyBadge'
import { useT } from '../../../hooks/useT'

interface FormState {
  name: string
  domain: string
  notes: string
}

const EMPTY: FormState = { name: '', domain: '', notes: '' }

const inputCls = 'input-base'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function errorDetail(err: unknown, fallback: string): string {
  const detail = (err as any)?.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

function CompanyForm({ initial, onSave, onCancel, isPending, serverError }: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  isPending: boolean
  serverError: string | null
}) {
  const t = useT()
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState('')

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError(t('admin_companies_name_req')); return }
    setError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('admin_companies_name_label')}</label>
          <input
            className={inputCls} value={form.name} onChange={set('name')}
            placeholder="Acme Ltd" maxLength={255} autoFocus
          />
        </div>
        <div>
          <label className={labelCls}>{t('admin_companies_domain_label')}</label>
          <input
            className={inputCls} value={form.domain} onChange={set('domain')}
            placeholder="acme.nl" maxLength={255}
          />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t('admin_companies_notes_label')}</label>
        <textarea
          className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`}
          value={form.notes} onChange={set('notes')}
          placeholder={t('admin_companies_notes_ph')}
        />
      </div>
      {(error || serverError) && <p className="text-sm text-red-500">{error || serverError}</p>}
      <div className="flex gap-3">
        <button
          type="submit" disabled={isPending}
          className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
        >
          {isPending ? t('admin_companies_saving') : t('admin_save')}
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          {t('admin_cancel')}
        </button>
      </div>
    </form>
  )
}

export default function CompaniesPage() {
  const t = useT()
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
    return <p className="text-sm text-red-500 p-8">{t('admin_access_denied')}</p>
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="heading-xl text-slate-900 mb-1">{t('admin_companies_title')}</h1>
          <p className="text-sm text-slate-500">
            {t('admin_companies_desc')}
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={2.5} />
            {t('admin_companies_new_btn')}
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('admin_companies_new_hdr')}</p>
          <CompanyForm
            initial={EMPTY}
            onSave={f => createMutation.mutate(f)}
            onCancel={() => { setShowCreate(false); createMutation.reset() }}
            isPending={createMutation.isPending}
            serverError={createMutation.isError ? errorDetail(createMutation.error, t('admin_something_wrong')) : null}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">{t('admin_companies_loading')}</p>}

      {!isLoading && companies?.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">{t('admin_companies_empty')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('admin_companies_empty_desc')}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {companies?.map((company: any) => (
          <div key={company.id}>
            {editingId === company.id ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  {t('admin_companies_edit_hdr').replace('{name}', company.name)}
                </p>
                <CompanyForm
                  initial={{ name: company.name, domain: company.domain ?? '', notes: company.notes ?? '' }}
                  onSave={f => updateMutation.mutate({ id: company.id, f })}
                  onCancel={() => { setEditingId(null); updateMutation.reset() }}
                  isPending={updateMutation.isPending}
                  serverError={updateMutation.isError ? errorDetail(updateMutation.error, t('admin_something_wrong')) : null}
                />
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyBadge name={company.name} />
                  {company.domain && <span className="text-xs text-slate-400 truncate">{company.domain}</span>}
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {company.contact_count} {company.contact_count !== 1 ? t('admin_companies_contacts') : t('admin_companies_contact_one')}
                  </span>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => { setEditingId(company.id); setShowCreate(false) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Pencil size={11} />
                    {t('admin_companies_edit_btn')}
                  </button>
                  <button
                    onClick={() => { if (confirm(t('admin_companies_delete_confirm').replace('{name}', company.name))) deleteMutation.mutate(company.id) }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={11} />
                    {t('admin_companies_delete_btn')}
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
