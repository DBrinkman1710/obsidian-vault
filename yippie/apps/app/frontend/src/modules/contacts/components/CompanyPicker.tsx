import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/useAuth'
import { fetchCompanies } from './CompanyBadge'

export function CompanyPicker({ value, onChange }: {
  value: string | null
  onChange: (companyId: string | null) => void
}) {
  const { user } = useAuth()
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: fetchCompanies,
  })

  if (isLoading) return <p className="text-xs text-slate-400">Loading companies…</p>

  if (!companies || companies.length === 0) {
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
    return (
      <p className="text-xs text-slate-400">
        No companies yet.
        {isAdmin && (
          <> Add them in <Link to="/settings/companies" className="text-blue-600 hover:underline">Settings → Companies</Link>.</>
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
      <option value="">No company</option>
      {companies.map((c: any) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
