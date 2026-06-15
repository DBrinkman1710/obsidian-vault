import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Lock, Trash2, X, CalendarClock } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'
import SendBookingModal from '../../booking/SendBookingModal'

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-blue-600 text-white border-blue-600',
  in_progress: 'bg-amber-500 text-white border-amber-500',
  waiting:     'bg-violet-600 text-white border-violet-600',
  resolved:    'bg-green-600 text-white border-green-600',
  closed:      'bg-slate-500 text-white border-slate-500',
}

const STATUS_INACTIVE = 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const config = useTenantConfig()
  const bookingEnabled = config?.enabled_modules?.includes('booking') ?? false
  const canDelete = user?.role === 'admin' || user?.role === 'superadmin'
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [bookingOpen, setBookingOpen] = useState(false)

  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
  })

  const { data: ticketContact } = useQuery({
    queryKey: ['contact', ticket?.contact_id],
    queryFn: () => api.get(`/contacts/${ticket.contact_id}`).then(r => r.data),
    enabled: !!ticket?.contact_id && bookingEnabled,
  })
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => api.get(`/tickets/${id}/comments`).then(r => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/tickets/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/comments`, { body: comment, is_internal: isInternal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-comments', id] })
      setComment('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/delete`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      navigate('/tickets')
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setDeleteError(typeof detail === 'string' ? detail : 'Failed to delete ticket')
    },
  })

  if (!ticket) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div className={ticket.contact_id ? 'flex gap-6 items-start' : 'max-w-2xl'}>
    <div className="flex-1 min-w-0 max-w-2xl">
      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-red-600">Delete ticket</h2>
              <button onClick={() => setConfirmingDelete(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-slate-600">
                Delete <strong>{ticket.subject}</strong>? It disappears from all views; its history is kept.
              </p>
              {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirmingDelete(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ticket.sla_due_at && (() => {
        const due = new Date(ticket.sla_due_at)
        const hoursLeft = (due.getTime() - Date.now()) / 3_600_000
        if (hoursLeft > 24) return null
        return (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${hoursLeft < 0 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
            ⚠ {hoursLeft < 0 ? `SLA overdue (was due ${due.toLocaleString()})` : `SLA due in ${Math.ceil(hoursLeft)}h — ${due.toLocaleString()}`}
          </div>
        )
      })()}

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          {bookingEnabled && ticket.contact_id && ticketContact && (
            <button
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <CalendarClock size={12} />
              Send booking link
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => { setDeleteError(''); setConfirmingDelete(true) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      </div>

      {bookingEnabled && ticketContact && (
        <SendBookingModal
          contacts={[{ id: ticketContact.id, full_name: ticketContact.full_name }]}
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
        />
      )}

      <div className="flex gap-3 mb-6 text-sm text-slate-600">
        <span>Status: <strong className="text-slate-900">{ticket.status}</strong></span>
        <span>Priority: <strong className="text-slate-900">{ticket.priority}</strong></span>
        <span>Source: <strong className="text-slate-900">{ticket.source}</strong></span>
      </div>

      {ticket.description && (
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-200">
          {ticket.description}
        </p>
      )}

      <div className="flex gap-2 mb-8 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => statusMutation.mutate(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize ${ticket.status === s ? STATUS_STYLES[s] : STATUS_INACTIVE}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Comments</h3>

      <div className="flex flex-col gap-3 mb-6">
        {comments?.map((c: any) => (
          <div key={c.id} className={`rounded-xl border p-4 ${c.is_internal ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            {c.is_internal && (
              <div className="flex items-center gap-1.5 mb-2">
                <Lock size={11} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Internal note</p>
              </div>
            )}
            <p className="text-sm text-slate-900 whitespace-pre-wrap">{c.body}</p>
            <p className="text-xs text-slate-400 mt-2">{new Date(c.created_at).toLocaleString()}</p>
          </div>
        ))}
        {(!comments || comments.length === 0) && (
          <p className="text-sm text-slate-400">No comments yet.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Write a reply or note…"
          rows={4}
          className="w-full text-sm text-slate-900 resize-none focus:outline-none placeholder-slate-400"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={e => setIsInternal(e.target.checked)}
              className="rounded border-slate-300"
            />
            <Lock size={12} className="text-slate-400" />
            Internal note
          </label>
          <button
            onClick={() => commentMutation.mutate()}
            disabled={!comment.trim() || commentMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            <Send size={13} />
            Send
          </button>
        </div>
      </div>
    </div>
    {ticket.contact_id && <CustomerPanel contactId={ticket.contact_id} />}
    </div>
  )
}

function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

function draftSubject(d: any): string {
  return d.final_subject ?? d.ai_suggested_subject ?? d.inbound_subject ?? '(no subject)'
}

function CustomerPanel({ contactId }: { contactId: string }) {
  const navigate = useNavigate()
  const [openDraft, setOpenDraft] = useState<any | null>(null)

  const { data: contact } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then(r => r.data),
  })
  const { data: drafts } = useQuery({
    queryKey: ['contact-correspondence', contactId],
    queryFn: () =>
      api.get(`/inbox/drafts`, { params: { contact_id: contactId, status: 'processed' } }).then(r => r.data),
  })
  const { data: ticketsData } = useQuery({
    queryKey: ['contact-tickets', contactId],
    queryFn: () => api.get(`/tickets`, { params: { contact_id: contactId } }).then(r => r.data),
  })

  const recent = (drafts ?? []).slice(0, 5)
  const ticketCount = ticketsData?.total ?? 0

  return (
    <aside className="w-72 shrink-0">
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
            {initials(contact?.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{contact?.full_name ?? '…'}</p>
            {contact?.email && <p className="text-xs text-slate-500 truncate">{contact.email}</p>}
          </div>
        </div>

        {contact?.company?.name && (
          <p className="text-xs text-slate-600 mt-3 flex items-center gap-1.5">
            <span>🏢</span>
            <span className="truncate">{contact.company.name}</span>
          </p>
        )}

        {contact?.labels && contact.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {contact.labels.map((l: any) => (
              <span
                key={l.id}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${l.color}20`, color: l.color }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3">
          {ticketCount} ticket{ticketCount === 1 ? '' : 's'} total
        </p>

        <button
          onClick={() => navigate(`/contacts/${contactId}`)}
          className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          → View contact
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mt-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Recent correspondence
        </h3>
        {recent.length === 0 && <p className="text-xs text-slate-400">No correspondence yet.</p>}
        <div className="flex flex-col gap-0.5">
          {recent.map((d: any) => (
            <button
              key={d.id}
              onClick={() => setOpenDraft(d)}
              className="text-left hover:bg-slate-50 cursor-pointer rounded-lg px-2 py-1.5 flex items-center justify-between gap-2"
            >
              <span className="text-xs text-slate-700 truncate">{draftSubject(d)}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(d.created_at)}</span>
            </button>
          ))}
        </div>
      </div>

      {openDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 truncate pr-2">{draftSubject(openDraft)}</h2>
              <button onClick={() => setOpenDraft(null)} className="text-slate-400 hover:text-slate-600 shrink-0">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="text-xs text-slate-500">
                {contact?.email && <span>{contact.email}</span>}
                {' · '}
                <span>{new Date(openDraft.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {openDraft.ai_suggested_description
                  ? openDraft.ai_suggested_description.slice(0, 500)
                  : '(no preview available)'}
              </p>
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate(`/inbox/drafts/${openDraft.id}`)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Open in inbox →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
