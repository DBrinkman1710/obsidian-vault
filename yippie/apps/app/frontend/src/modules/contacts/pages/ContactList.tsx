import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, User, ChevronLeft } from 'lucide-react'
import { api } from '../../../api/client'
import { TableSkeleton } from '../../../shell/Skeleton'
import { LabelChip, fetchLabels, type ContactLabel } from '../components/LabelChip'
import { CompanyBadge, fetchCompanies, type CompanyRef } from '../components/CompanyBadge'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: CompanyRef | null
  phone: string | null
  labels: ContactLabel[]
  created_at: string
}

export default function ContactList() {
  const navigate = useNavigate()
  const { companyId } = useParams<{ companyId?: string }>()
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string | null>(companyId ?? null)
  const { data: labels } = useQuery({ queryKey: ['contact-labels'], queryFn: fetchLabels })
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: fetchCompanies })
  const scopedCompany = companyId ? companies?.find(c => c.id === companyId) : null
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, labelFilter, companyFilter],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', {
      params: {
        search: search || undefined,
        label_id: labelFilter || undefined,
        company_id: companyFilter || undefined,
      },
    }).then(r => r.data),
  })

  return (
    <div>
      <div className="mb-6">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-3 transition-colors">
          <ChevronLeft size={13} />
          Companies
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {scopedCompany ? scopedCompany.name : 'All Contacts'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} contact{(data?.total ?? 0) !== 1 ? 's' : ''}</p>
          </div>
          <Link
            to="/contacts/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Contact
          </Link>
        </div>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          placeholder="Search by name, email, or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            All
          </button>
          {labels.map(label => (
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
            All companies
          </button>
          {companies.map(company => (
            <CompanyBadge
              key={company.id}
              name={company.name}
              selected={companyFilter === company.id}
              onClick={() => setCompanyFilter(companyFilter === company.id ? null : company.id)}
            />
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Name</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Company</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Labels</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Phone</th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton cols={5} />
          ) : (
            <tbody className="divide-y divide-slate-100">
              {data?.items.map(c => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User size={13} className="text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-blue-600">
                        {c.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.email ?? '—'}</td>
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
                      <span className="text-sm text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.labels.length === 0 ? (
                      <span className="text-sm text-slate-600">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {c.labels.slice(0, 3).map(label => <LabelChip key={label.id} label={label} />)}
                        {c.labels.length > 3 && (
                          <span className="text-xs text-slate-400 self-center">+{c.labels.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{c.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {!isLoading && data?.items.length === 0 && (
          <div className="py-12 text-center">
            <User size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No contacts found</p>
          </div>
        )}
      </div>
    </div>
  )
}
