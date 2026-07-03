import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { api } from '../../../api/client'
import { LabelPicker } from '../components/LabelChip'
import { CompanyPicker } from '../components/CompanyPicker'

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
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Partial<FormState>>({})

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  function validate(): boolean {
    const next: Partial<FormState> = {}
    if (!form.full_name.trim()) next.full_name = 'Name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = 'Enter a valid email address'
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
    `w-full px-3 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasError ? 'border-red-400' : 'border-slate-300'}`

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-7">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ChevronLeft size={16} />
          Contacts
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-2xl font-bold text-slate-900">New Contact</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Full name *</label>
          <input
            className={inputClass(!!errors.full_name)}
            value={form.full_name} onChange={set('full_name')}
            placeholder="Alex Johnson" autoFocus
          />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
            <input
              className={inputClass(!!errors.email)}
              type="email" value={form.email} onChange={set('email')}
              placeholder="alex@example.com"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Phone</label>
            <input className={inputClass()} value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Company</label>
          <CompanyPicker value={companyId} onChange={setCompanyId} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Labels</label>
          <LabelPicker selectedIds={labelIds} onChange={setLabelIds} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes</label>
          <textarea
            className={`${inputClass()} resize-vertical min-h-[100px] font-[inherit]`}
            value={form.notes} onChange={set('notes')}
            placeholder="Any context about this contact…"
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-500">Something went wrong. Try again.</p>
        )}

        <div className="flex gap-3 items-center">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-yippie hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Saving…' : 'Create contact'}
          </button>
          <Link to="/contacts" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
