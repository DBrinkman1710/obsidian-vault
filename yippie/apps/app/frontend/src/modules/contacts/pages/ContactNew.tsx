import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { api } from '../../../api/client'
import { LabelPicker } from '../components/LabelChip'
import { CompanyPicker } from '../components/CompanyPicker'
import { fetchCompanies } from '../components/CompanyBadge'
import { useT } from '../../../hooks/useT'

interface FormState {
  full_name: string
  email: string
  phone: string
  notes: string
}

const EMPTY: FormState = {
  full_name: '', email: '', phone: '', notes: '',
}

export default function ContactNew() {
  const t = useT()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState<FormState>(EMPTY)
  // Smart default: when opened from a company context (?company=<id>), pre-fill
  // the company so the user doesn't re-pick what they already knew.
  const [companyId, setCompanyId] = useState<string | null>(searchParams.get('company'))
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Partial<FormState>>({})

  // The ?company= param is untrusted (hand-editable URL). Once the tenant's
  // companies load, drop a seeded id that isn't one of them so we never submit
  // a company that doesn't belong to this tenant. Shares CompanyPicker's query.
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies })
  useEffect(() => {
    if (companyId && companies && !companies.some((c: any) => c.id === companyId)) {
      setCompanyId(null)
    }
  }, [companies, companyId])

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  function validate(): boolean {
    const next: Partial<FormState> = {}
    if (!form.full_name.trim()) next.full_name = t('contacts_full_name_required')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = t('contacts_email_invalid')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/contacts', {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company_id: companyId,
        notes: form.notes.trim() || null,
        label_ids: labelIds.length ? labelIds : null,
      }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      navigate(`/contacts/${res.data.id}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  const inputClass = (hasError?: boolean) =>
    `w-full px-3 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie ${hasError ? 'border-red-400' : 'border-slate-300'}`

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-7">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ChevronLeft size={16} />
          {t('contacts_page_title')}
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="heading-xl text-slate-900">{t('contacts_new_page_title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('contacts_full_name_label')}</label>
          <input
            className={inputClass(!!errors.full_name)}
            value={form.full_name} onChange={set('full_name')}
            placeholder="Alex Johnson" autoFocus
          />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('contacts_field_email')}</label>
            <input
              className={inputClass(!!errors.email)}
              type="email" value={form.email} onChange={set('email')}
              placeholder="alex@example.com"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('contacts_field_phone')}</label>
            <input className={inputClass()} value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('contacts_field_company')}</label>
          <CompanyPicker value={companyId} onChange={setCompanyId} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('contacts_labels_label')}</label>
          <LabelPicker selectedIds={labelIds} onChange={setLabelIds} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('contacts_notes_field_label')}</label>
          <textarea
            className={`${inputClass()} resize-vertical min-h-[100px] font-[inherit]`}
            value={form.notes} onChange={set('notes')}
            placeholder={t('contacts_notes_field_ph')}
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-500">{t('contacts_field_error_generic')}</p>
        )}

        <div className="flex gap-3 items-center">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-yippie hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:cursor-not-allowed"
          >
            {mutation.isPending ? t('contacts_creating') : t('contacts_create_btn')}
          </button>
          <Link to="/contacts" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
            {t('contacts_field_cancel_btn')}
          </Link>
        </div>
      </form>
    </div>
  )
}
