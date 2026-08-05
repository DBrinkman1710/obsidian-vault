import { useQuery } from '@tanstack/react-query'
import { Building2, ExternalLink, Mail, Phone } from 'lucide-react'
import { CloseButton } from '../shell/CloseButton'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { LabelChip } from '../modules/contacts/components/LabelChip'
import type { ContactLabel } from '../modules/contacts/components/LabelChip'
import CallModal from '../modules/contacts/components/CallModal'

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
  onCompose,
}: {
  contactId: string | null
  onClose: () => void
  onCompose?: (email: string, name: string) => void
}) {
  const [callOpen, setCallOpen] = useState(false)

  const { data: contact, isLoading } = useQuery<ContactPeekData>({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then((r: any) => r.data),
    enabled: contactId !== null,
  })

  useEffect(() => {
    if (!contactId) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [contactId, onClose])

  if (contactId === null) return null

  return (
    <>
    <div
      className="fixed inset-0 z-50"
      onClick={onClose}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col"
        style={{ animation: 'slideInRight 0.18s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Contact</span>
          <CloseButton onClick={onClose} />
        </div>

        {isLoading || !contact ? (
          <div className="flex items-center justify-center flex-1">
            <span className="inline-block w-5 h-5 border-2 border-yippie border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-yippie/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-yippie">
                      {contact.full_name.split(' ').map((n: any) => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{contact.full_name}</h2>
                    {typeof contact.engagement_score === 'number' && (
                      <span
                        title="Engagement score"
                        className={`inline-block text-[11px] font-bold ${
                          contact.engagement_score >= 60
                            ? 'text-emerald-600'
                            : contact.engagement_score >= 30
                            ? 'text-amber-600'
                            : 'text-slate-400'
                        }`}
                      >
                        Score: {contact.engagement_score}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
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
                <div className="flex flex-wrap gap-1.5">
                  {contact.labels.map((label: any) => (
                    <LabelChip key={label.id} label={label} />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-5 py-4 flex flex-col gap-2">
              {contact.phone && (
                <button
                  onClick={() => setCallOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-white bg-yippie hover:opacity-90 rounded-xl transition-opacity"
                >
                  <Phone size={13} />
                  Call
                </button>
              )}
              {onCompose && contact.email && (
                <button
                  onClick={() => { onCompose(contact.email!, contact.full_name); onClose() }}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Mail size={13} />
                  Compose email
                </button>
              )}
              <button
                onClick={() => window.open(`/contacts/${contactId}`, '_blank')}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Open full contact
                <ExternalLink size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    {callOpen && contact && (
      <CallModal
        contact={{
          id: contactId,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
        }}
        onClose={() => setCallOpen(false)}
      />
    )}
    </>
  )
}
