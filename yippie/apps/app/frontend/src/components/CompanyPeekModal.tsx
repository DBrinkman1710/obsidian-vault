import { Building2, Globe, Users, X } from 'lucide-react'
import { useEffect } from 'react'

export interface CompanyPeekData {
  id: string
  name: string
  domain: string | null
  notes?: string | null
  contact_count: number
}

export default function CompanyPeekModal({
  company,
  onClose,
  onViewContacts,
}: {
  company: CompanyPeekData | null
  onClose: () => void
  onViewContacts?: (companyId: string) => void
}) {
  useEffect(() => {
    if (!company) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [company, onClose])

  if (!company) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col"
        style={{ animation: 'slideInRight 0.18s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Company</span>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-blue-500" />
            </div>
            <h2 className="text-base font-bold text-slate-900">{company.name}</h2>
          </div>

          <div className="space-y-2">
            {company.domain && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Globe size={13} className="shrink-0 text-slate-400" />
                <span>{company.domain}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users size={13} className="shrink-0 text-slate-400" />
              <span>{company.contact_count} contact{company.contact_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {company.notes && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700 leading-relaxed">{company.notes}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            onClick={() => { onViewContacts?.(company.id); onClose() }}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-yippie hover:opacity-90 rounded-xl transition-opacity"
          >
            <Users size={13} />
            View contacts
          </button>
        </div>
      </div>
    </div>
  )
}
