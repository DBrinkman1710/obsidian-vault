import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Building2, Users } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { fetchCompanies, type Company } from '../components/CompanyBadge'
import CompanyPeekModal, { type CompanyPeekData } from '../../../components/CompanyPeekModal'
import { useT } from '../../../hooks/useT'

interface FormState { name: string; domain: string; notes: string }
const EMPTY: FormState = { name: '', domain: '', notes: '' }
const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function errorDetail(err: unknown) {
  const d = (err as any)?.response?.data?.detail
  return typeof d === 'string' ? d : 'Something went wrong.'
}

function CompanyForm({ initial, onSave, onCancel, isPending, serverError }: {
  initial: FormState; onSave: (f: FormState) => void; onCancel: () => void
  isPending: boolean; serverError: string | null
}) {
  const t = useT()
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <form onSubmit={e => { e.preventDefault(); if (!form.name.trim()) { setError(t('contacts_name_required')); return } setError(''); onSave(form) }}
      className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>{t('contacts_company_name_label')}</label>
          <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Acme Ltd" maxLength={255} autoFocus />
        </div>
        <div>
          <label className={labelCls}>{t('contacts_domain_label')}</label>
          <input className={inputCls} value={form.domain} onChange={set('domain')} placeholder="acme.com" maxLength={255} />
        </div>
      </div>
      <div>
        <label className={labelCls}>{t('contacts_notes_label')}</label>
        <textarea className={`${inputCls} resize-vertical min-h-[70px] font-[inherit]`} value={form.notes} onChange={set('notes')} placeholder={t('contacts_notes_ph')} />
      </div>
      {(error || serverError) && <p className="text-sm text-red-500">{error || serverError}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={isPending}
          className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity">
          {isPending ? t('contacts_saving') : t('contacts_save')}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          {t('contacts_field_cancel_btn')}
        </button>
      </div>
    </form>
  )
}

export default function CompaniesPage() {
  const t = useT()
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [peekCompany, setPeekCompany] = useState<CompanyPeekData | null>(null)
  const { data: companies, isLoading } = useQuery<Company[]>({ queryKey: ['companies'], queryFn: fetchCompanies })

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['companies'] }); qc.invalidateQueries({ queryKey: ['contacts'] }) }
  const toPayload = (f: FormState) => ({ name: f.name.trim(), domain: f.domain.trim() || null, notes: f.notes.trim() || null })

  const createMutation = useMutation({ mutationFn: (f: FormState) => api.post('/contacts/companies', toPayload(f)), onSuccess: () => { invalidate(); setShowCreate(false) } })
  const updateMutation = useMutation({ mutationFn: ({ id, f }: { id: string; f: FormState }) => api.patch(`/contacts/companies/${id}`, toPayload(f)), onSuccess: () => { invalidate(); setEditingId(null) } })
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/contacts/companies/${id}`), onSuccess: invalidate })

  const totalContacts = companies?.reduce((s: any, c: any) => s + c.contact_count, 0) ?? 0

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="heading-xl text-slate-900 mb-1">{t('contacts_page_title')}</h1>
          <p className="text-sm text-slate-500">{t('contacts_companies_count').replace('{n}', String(companies?.length ?? 0)).replace('{m}', String(totalContacts))}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isAdmin && !showCreate && (
            <button onClick={() => { setShowCreate(true); setEditingId(null) }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity whitespace-nowrap">
              <Plus size={15} strokeWidth={2.5} />
              {t('contacts_new_company_btn')}
            </button>
          )}
          <Link to="/contacts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold border border-slate-200 rounded-lg transition-colors whitespace-nowrap">
            <Plus size={15} strokeWidth={2.5} />
            {t('contacts_new_contact_btn')}
          </Link>
        </div>
      </div>

      {showCreate && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('contacts_new_company_section')}</p>
          <CompanyForm initial={EMPTY} onSave={f => createMutation.mutate(f)} onCancel={() => { setShowCreate(false); createMutation.reset() }}
            isPending={createMutation.isPending} serverError={createMutation.isError ? errorDetail(createMutation.error) : null} />
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400 py-8">{t('contacts_loading')}</p>}

      <div className="flex flex-col gap-3">
        {/* All contacts row */}
        <div
          onClick={() => navigate('/contacts/list')}
          className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <Users size={15} className="text-slate-500" />
          </div>
          <span className="text-sm font-semibold text-slate-700 flex-1">{t('contacts_all_contacts_row')}</span>
          <span className="text-xs text-slate-400">{(totalContacts !== 1 ? t('contacts_peek_contact_count_many') : t('contacts_peek_contact_count_one')).replace('{n}', String(totalContacts))}</span>
        </div>

        {companies?.map((company: any) => (
          <div key={company.id}>
            {editingId === company.id ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('contacts_edit_company_section').replace('{name}', company.name)}</p>
                <CompanyForm
                  initial={{ name: company.name, domain: company.domain ?? '', notes: company.notes ?? '' }}
                  onSave={f => updateMutation.mutate({ id: company.id, f })}
                  onCancel={() => { setEditingId(null); updateMutation.reset() }}
                  isPending={updateMutation.isPending}
                  serverError={updateMutation.isError ? errorDetail(updateMutation.error) : null}
                />
              </div>
            ) : (
              <div
                onClick={() => { if (editingId) return; setPeekCompany(company) }}
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
                  {(company.contact_count !== 1 ? t('contacts_peek_contact_count_many') : t('contacts_peek_contact_count_one')).replace('{n}', String(company.contact_count))}
                </span>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingId(company.id); setShowCreate(false) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Pencil size={11} /> {t('contacts_edit')}
                    </button>
                    <button onClick={() => { if (confirm(t('contacts_company_delete_contacts_remain').replace('{name}', company.name))) deleteMutation.mutate(company.id) }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={11} /> {t('contacts_delete_companies')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!isLoading && companies?.length === 0 && !showCreate && (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
            <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">{t('contacts_no_companies_yet')}</p>
            {isAdmin && <p className="text-xs text-slate-400 mt-1">{t('contacts_no_companies_create')}</p>}
          </div>
        )}
      </div>

      <CompanyPeekModal
        company={peekCompany}
        onClose={() => setPeekCompany(null)}
        onViewContacts={id => navigate(`/contacts/list/${id}`)}
        onAddContact={id => navigate(`/contacts/new?company=${id}`)}
      />
    </div>
  )
}
