import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, User } from 'lucide-react'
import { api } from '../../../api/client'
import { TableSkeleton } from '../../../shell/Skeleton'
import { LabelChip, fetchLabels, type ContactLabel } from '../components/LabelChip'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: string | null
  phone: string | null
  labels: ContactLabel[]
  created_at: string
}

export default function ContactList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const { data: labels } = useQuery({ queryKey: ['contact-labels'], queryFn: fetchLabels })
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search, labelFilter],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', {
      params: { search: search || undefined, label_id: labelFilter || undefined },
    }).then(r => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} total</p>
        </div>
        <Link
          to="/contacts/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} />
          New Contact
        </Link>
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
                  <td className="px-4 py-3 text-sm text-slate-600">{c.company ?? '—'}</td>
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
