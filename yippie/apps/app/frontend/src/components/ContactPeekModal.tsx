import { useQuery } from '@tanstack/react-query'
import { Building2, ExternalLink, Mail, Phone, X } from 'lucide-react'
import { api } from '../api/client'
import { LabelChip } from '../modules/contacts/components/LabelChip'
import type { ContactLabel } from '../modules/contacts/components/LabelChip'

interface ContactPeekData {
  full_name: string
  email: string | null
  phone: string | null
  company: { name: string } | null
  labels: ContactLabel[]
  engagement_score: number | null
}

export default function ContactPeekModal({
  contactId,
  onClose,
}: {
  contactId: string | null
  onClose: () => void
}) {
  const { data: contact, isLoading } = useQuery<ContactPeekData>({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then(r => r.data),
    enabled: contactId !== null,
  })

  if (contactId === null) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>

        {isLoading || !contact ? (
          <div className="flex items-center justify-center py-8">
            <span className="inline-block w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="pr-8 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900">{contact.full_name}</h2>
                {typeof contact.engagement_score === 'number' && (
                  <span
                    title="Engagement score"
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      contact.engagement_score >= 60
                        ? 'bg-emerald-50 text-emerald-700'
                        : contact.engagement_score >= 30
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {contact.engagement_score}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {contact.email && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Mail size={13} className="shrink-0 text-slate-400" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={13} className="shrink-0 text-slate-400" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Building2 size={13} className="shrink-0 text-slate-400" />
                  <span>{contact.company.name}</span>
                </div>
              )}
            </div>

            {contact.labels && contact.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {contact.labels.map(label => (
                  <LabelChip key={label.id} label={label} />
                ))}
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => window.open(`/contacts/${contactId}`, '_blank')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Open full page
                <ExternalLink size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
