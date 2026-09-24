import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { fetchCompanies } from './CompanyBadge'
import { useT } from '../../../hooks/useT'

// Sentinel select value that switches the picker into "create a company" mode.
const CREATE_VALUE = '__create__'

export function CompanyPicker({ value, onChange }: {
  value: string | null
  onChange: (companyId: string | null) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  })

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  // Only admins can create companies (POST /contacts/companies requires admin).
  const createMutation = useMutation({
    mutationFn: (companyName: string) =>
      api.post('/contacts/companies', { name: companyName }).then((r: any) => r.data),
    onSuccess: async (created: any) => {
      await qc.invalidateQueries({ queryKey: ['companies'] })
      onChange(created.id)
      setCreating(false)
      setName('')
    },
  })

  function submitNew() {
    const trimmed = name.trim()
    if (trimmed) createMutation.mutate(trimmed)
  }

  if (isLoading) return <p className="text-xs text-slate-400">{t('contacts_loading_companies')}</p>

  // Inline create row — shown when the admin picks "+ New company…" or when
  // there are no companies yet.
  if (creating || (isAdmin && (!companies || companies.length === 0))) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); submitNew() }
              if (e.key === 'Escape') { setCreating(false); setName('') }
            }}
            placeholder={t('contacts_new_company_ph')}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={!name.trim() || createMutation.isPending}
            className="bg-yippie hover:opacity-90 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:cursor-not-allowed whitespace-nowrap"
          >
            {t('contacts_create_company_btn')}
          </button>
          {(companies && companies.length > 0) && (
            <button
              type="button"
              onClick={() => { setCreating(false); setName('') }}
              className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors px-1"
            >
              {t('contacts_field_cancel_btn')}
            </button>
          )}
        </div>
        {createMutation.isError && (
          <p className="text-xs text-danger-500">{t('contacts_create_company_failed')}</p>
        )}
      </div>
    )
  }

  // Non-admin with no companies: keep the old settings-link hint.
  if (!companies || companies.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        {t('contacts_no_companies_picker')}
      </p>
    )
  }

  return (
    <select
      value={value ?? ''}
      onChange={e => {
        if (e.target.value === CREATE_VALUE) { setCreating(true); return }
        onChange(e.target.value || null)
      }}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
    >
      <option value="">{t('contacts_no_company_select')}</option>
      {isAdmin && <option value={CREATE_VALUE}>{t('contacts_create_company_option')}</option>}
      {companies.map((c: any) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
