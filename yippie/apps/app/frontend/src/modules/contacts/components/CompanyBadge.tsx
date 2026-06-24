import { Building2 } from 'lucide-react'
import { api } from '../../../api/client'

export interface Company {
  id: string
  name: string
  domain: string | null
  notes: string | null
  contact_count: number
}

export interface CompanyRef {
  id: string
  name: string
}

export function fetchCompanies() {
  return api.get<Company[]>('/contacts/companies').then((r: any) => r.data)
}

export function CompanyBadge({ name, selected, onClick }: {
  name: string
  selected?: boolean
  onClick?: () => void
}) {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap'
  const tone = selected
    ? 'bg-slate-700 text-white border-slate-700'
    : 'bg-slate-100 text-slate-600 border-slate-200'
  if (!onClick) {
    return (
      <span className={`${base} ${tone}`}>
        <Building2 size={10} className="shrink-0" />
        {name}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${tone} ${selected ? 'hover:bg-slate-600' : 'hover:bg-slate-200'} transition-colors cursor-pointer`}
    >
      <Building2 size={10} className="shrink-0" />
      {name}
    </button>
  )
}
