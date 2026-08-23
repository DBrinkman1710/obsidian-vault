import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import { fetchCompanies } from './CompanyBadge'
import { useT } from '../../../hooks/useT'

export function CompanyPicker({ value, onChange }: {
  value: string | null
  onChange: (companyId: string | null) => void
}) {
  const t = useT()
  const { user } = useAuth()
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  })

  if (isLoading) return <p className="text-xs text-slate-400">{t('contacts_loading_companies')}</p>

  if (!companies || companies.length === 0) {
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
    return (
      <p className="text-xs text-slate-400">
        {t('contacts_no_companies_picker')}
        {isAdmin && (
          <> <Link to="/settings/companies" className="text-blue-600 hover:underline">{t('contacts_companies_settings_link')}</Link></>
        )}
      </p>
    )
  }

  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
    >
      <option value="">{t('contacts_no_company_select')}</option>
      {companies.map((c: any) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
