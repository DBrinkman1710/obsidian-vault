import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, X } from 'lucide-react'
import { api } from '../../../api/client'
import { useT } from '../../../hooks/useT'
import type { TKey } from '../../../i18n/translations'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: { id: string; name: string } | null
}

const PRIORITY_STYLES: Record<string, { active: string; inactive: string }> = {
  low:    { active: 'bg-slate-500 text-white border-slate-500',   inactive: 'border-slate-300 text-slate-500 hover:bg-slate-50' },
  medium: { active: 'bg-blue-600 text-white border-blue-600',     inactive: 'border-blue-300 text-blue-600 hover:bg-blue-50' },
  high:   { active: 'bg-amber-500 text-white border-amber-500',   inactive: 'border-amber-300 text-amber-600 hover:bg-amber-50' },
  urgent: { active: 'bg-red-600 text-white border-red-600',       inactive: 'border-red-300 text-red-600 hover:bg-red-50' },
}

function ContactPicker({ value, onChange }: {
  value: { id: string; label: string } | null
  onChange: (c: { id: string; label: string } | null) => void
}) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['contacts-picker', search],
    queryFn: () => api.get<{ items: Contact[] }>('/contacts', { params: { search: search || undefined, limit: 8 } }).then((r: any) => r.data.items),
    enabled: open,
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">{value.label}</span>
        <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={t('ticket_contact_search_ph')}
      />
      {open && (
        <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
          {!data?.length && (
            <div className="px-4 py-3 text-sm text-slate-400">
              {search
                ? <>{t('ticket_contact_not_found')} <Link to="/contacts/new" className="text-blue-600 hover:underline">{t('ticket_contact_create')}</Link></>
                : <>{t('ticket_contact_typing')} <Link to="/contacts/new" className="text-blue-600 hover:underline">{t('ticket_contact_add')}</Link></>
              }
            </div>
          )}
          {data?.map((c: any) => (
            <button
              key={c.id} type="button"
              onMouseDown={() => {
                onChange({ id: c.id, label: c.company ? `${c.full_name} (${c.company.name})` : c.full_name })
                setOpen(false)
                setSearch('')
              }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
            >
              <span className="font-medium text-slate-900">{c.full_name}</span>
              {c.company && <span className="text-slate-500 ml-2">{c.company.name}</span>}
              {c.email && <span className="text-slate-400 ml-2 text-xs">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TicketNew() {
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [contact, setContact] = useState<{ id: string; label: string } | null>(null)
  const [departmentId, setDepartmentId] = useState('')
  const [errors, setErrors] = useState<{ subject?: string; contact?: string }>({})

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r: any) => r.data),
  })

  useEffect(() => {
    const id = searchParams.get('contact_id')
    const name = searchParams.get('contact_name')
    if (id && name) setContact({ id, label: name })
  }, [searchParams])

  function validate() {
    const next: { subject?: string; contact?: string } = {}
    if (!subject.trim()) next.subject = t('ticket_subject_required')
    if (!contact) next.contact = t('ticket_contact_required')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/tickets', {
        subject: subject.trim(),
        description: description.trim() || null,
        priority,
        contact_id: contact?.id ?? null,
        department_id: departmentId || null,
        source: 'manual',
      }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      navigate(`/tickets/${res.data.id}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) mutation.mutate()
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-7">
        <Link to="/tickets" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
          <ChevronLeft size={16} />
          Tickets
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="heading-xl text-slate-900">{t('ticket_new_title')}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticket_subject_label')} *</label>
          <input
            className={`input-base ${errors.subject ? 'input-error' : ''}`}
            value={subject} onChange={e => setSubject(e.target.value)}
            placeholder={t('ticket_subject_ph')} autoFocus
          />
          {errors.subject && <p className="error-text mt-1">{errors.subject}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            {t('ticket_contact_label')} *
          </label>
          <ContactPicker value={contact} onChange={setContact} />
          {errors.contact && <p className="error-text mt-1">{errors.contact}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticket_priority_label')}</label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
              <button
                key={p} type="button" onClick={() => setPriority(p)}
                className={`px-4 py-1.5 rounded-full border text-xs font-semibold transition-colors ${priority === p ? PRIORITY_STYLES[p].active : PRIORITY_STYLES[p].inactive}`}
              >
                {t(`priority_${p}` as TKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            {t('ticket_dept_label')} <span className="font-normal text-slate-400 normal-case">{t('ticket_dept_optional')}</span>
          </label>
          <select
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
            className="input-base"
          >
            <option value="">{t('ticket_dept_none')}</option>
            {departments?.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name} ({d.sla_working_days}d SLA)</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('ticket_desc_label')}</label>
          <textarea
            className="input-base resize-vertical min-h-[120px] font-[inherit]"
            value={description} onChange={e => setDescription(e.target.value)}
            placeholder={t('ticket_desc_ph')}
          />
        </div>

        {mutation.isError && (
          <p className="error-text">{t('something_went_wrong')}</p>
        )}

        <div className="flex gap-3 items-center">
          <button
            type="submit" disabled={mutation.isPending}
            className="btn-primary px-4 py-2"
          >
            {mutation.isPending ? t('ticket_creating') : t('ticket_create_btn')}
          </button>
          <Link to="/tickets" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
            {t('cancel')}
          </Link>
        </div>
      </form>
    </div>
  )
}
