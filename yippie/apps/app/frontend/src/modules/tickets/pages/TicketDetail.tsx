import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Lock, Trash2, X, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'
import SendBookingModal from '../../booking/SendBookingModal'

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

const STATUS_LABELS: Record<string, string> = {
  open:        'Open',
  in_progress: 'In progress',
  waiting:     'Waiting for customer',
  resolved:    'Resolved',
  closed:      'Closed',
}

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']

const PRIORITY_LABELS: Record<string, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
}

const PRIORITY_TEXT: Record<string, string> = {
  low:    'text-slate-600',
  medium: 'text-blue-600',
  high:   'text-amber-600',
  urgent: 'text-red-600',
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const config = useTenantConfig()
  const bookingEnabled = config?.enabled_modules?.includes('booking') ?? false
  const canDelete = user?.role === 'admin' || user?.role === 'superadmin'
  const [comment, setComment] = useState('')
  const [activeTab, setActiveTab] = useState<'reply' | 'internal'>('reply')
  const isInternal = activeTab === 'internal'
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [bookingOpen, setBookingOpen] = useState(false)

  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
  })

  const { data: ticketContact } = useQuery({
    queryKey: ['ticket-contact-booking', ticket?.contact_id],
    queryFn: () => api.get(`/contacts/${ticket.contact_id}`).then(r => r.data),
    enabled: !!ticket?.contact_id && bookingEnabled,
  })
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => api.get(`/tickets/${id}/comments`).then(r => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/tickets/${id}/status`, { status }),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: ['ticket', id] })
      const prev = qc.getQueryData(['ticket', id])
      qc.setQueryData(['ticket', id], (old: any) => old ? { ...old, status } : old)
      return { prev }
    },
    onError: (_err, _status, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ticket', id], ctx.prev)
      toast.error('Failed to update status.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const priorityMutation = useMutation({
    mutationFn: (priority: string) => api.patch(`/tickets/${id}`, { priority }),
    onMutate: async (priority) => {
      await qc.cancelQueries({ queryKey: ['ticket', id] })
      const prev = qc.getQueryData(['ticket', id])
      qc.setQueryData(['ticket', id], (old: any) => old ? { ...old, priority } : old)
      return { prev }
    },
    onError: (_err, _priority, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ticket', id], ctx.prev)
      toast.error('Failed to update priority.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const snoozeMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/snooze`),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['ticket', id] })
      const prev = qc.getQueryData(['ticket', id])
      qc.setQueryData(['ticket', id], (old: any) =>
        old ? { ...old, sla_due_at: new Date(Date.now() + 86400000).toISOString() } : old)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['ticket', id], ctx.prev)
      toast.error('Failed to snooze ticket.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/comments`, { body: comment, is_internal: isInternal }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['ticket-comments', id] })
      const prev = qc.getQueryData(['ticket-comments', id])
      const optimistic = { id: 'temp-' + Date.now(), body: comment, is_internal: isInternal, created_at: new Date().toISOString(), author_name: user?.full_name ?? 'You' }
      qc.setQueryData(['ticket-comments', id], (old: any[]) => [optimistic, ...(old ?? [])])
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['ticket-comments', id], ctx.prev)
      toast.error('Failed to post comment.')
    },
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
    <div className="flex gap-8 items-start">
    <div className="flex-1 min-w-0">
      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
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
                <button onClick={() => setConfirmingDelete(false)} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">Cancel</button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed"
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
        const overdue = hoursLeft < 0
        return (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between gap-3 ${overdue ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
            <span className="flex items-center gap-2 min-w-0">
              ⚠ {overdue ? `SLA overdue (was due ${due.toLocaleString()})` : `SLA due in ${Math.ceil(hoursLeft)}h — ${due.toLocaleString()}`}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => snoozeMutation.mutate()}
                disabled={snoozeMutation.isPending}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${overdue ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-orange-300 text-orange-700 hover:bg-orange-100'}`}
              >
                Snooze 24h
              </button>
              {ticket.priority !== 'urgent' && (
                <button
                  onClick={() => priorityMutation.mutate('urgent')}
                  disabled={priorityMutation.isPending}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${overdue ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-orange-300 text-orange-700 hover:bg-orange-100'}`}
                >
                  Escalate
                </button>
              )}
            </div>
          </div>
        )
      })()}

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-slate-900">{ticket.subject}</h1>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={ticket.status}
            onChange={e => statusMutation.mutate(e.target.value)}
            disabled={statusMutation.isPending}
            className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
            ))}
          </select>
          <select
            value={ticket.priority}
            onChange={e => priorityMutation.mutate(e.target.value)}
            disabled={priorityMutation.isPending}
            className={`text-xs px-2 py-1 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 ${PRIORITY_TEXT[ticket.priority] ?? 'text-slate-600'}`}
          >
            {PRIORITY_OPTIONS.map(p => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
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
        <span>Source: <strong className="text-slate-900">{ticket.source}</strong></span>
      </div>

      {ticket.description && (
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-200">
          {ticket.description}
        </p>
      )}

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
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setActiveTab('reply')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${activeTab === 'reply' ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-50 text-slate-500 border-transparent hover:text-slate-700'}`}
          >
            Reply
          </button>
          <button
            onClick={() => setActiveTab('internal')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${activeTab === 'internal' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-transparent hover:text-slate-700'}`}
          >
            <Lock size={11} />
            Internal Note
          </button>
        </div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={isInternal ? 'Write an internal note…' : 'Write a reply…'}
          rows={4}
          className={`w-full text-sm text-slate-900 resize-none focus:outline-none placeholder-slate-400 rounded-lg p-2 ${isInternal ? 'bg-amber-50' : 'bg-white'}`}
        />
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => commentMutation.mutate()}
            disabled={!comment.trim() || commentMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            <Send size={13} />
            Send
            {commentMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />}
          </button>
        </div>
      </div>
    </div>
    <CustomerPanel contactId={ticket.contact_id ?? null} ticket={ticket} />
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

function CustomerPanel({ contactId, ticket }: { contactId: string | null; ticket: any }) {
  const navigate = useNavigate()
  const [openDraft, setOpenDraft] = useState<any | null>(null)

  const { data: contact, isLoading: contactLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then(r => r.data),
    enabled: !!contactId,
    retry: 1,
  })
  const { data: drafts } = useQuery({
    queryKey: ['contact-correspondence', contactId],
    queryFn: () =>
      api.get(`/inbox/drafts`, { params: { contact_id: contactId, status: 'processed' } }).then(r => r.data),
    enabled: !!contactId,
  })
  const { data: ticketsData } = useQuery({
    queryKey: ['contact-tickets', contactId],
    queryFn: () => api.get(`/tickets`, { params: { contact_id: contactId } }).then(r => r.data),
    enabled: !!contactId,
  })

  const recent = (drafts ?? []).slice(0, 5)
  const ticketCount = ticketsData?.total ?? 0

  const scanText = `${ticket?.description ?? ''} ${ticket?.subject ?? ''}`
  const invoiceMatches = Array.from(
    new Set(scanText.match(/INV[-\s]?\d+|#\d{4,}/gi) ?? [])
  )
  const priorTickets = (ticketsData?.items ?? []).filter((t: any) => t.id !== ticket?.id)
  const priorCount = Math.max(ticketCount - 1, 0)
  const priorSubjects = priorTickets.slice(0, 2)

  return (
    <aside className="w-96 flex-shrink-0">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Contact</h2>
          <p className="text-sm text-slate-500">Customer context &amp; history.</p>
        </div>
      </div>
      {/* Contact card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {!contactId ? (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-slate-400">No contact linked to this ticket.</p>
          </div>
        ) : contactLoading ? (
          <div className="px-4 py-4 flex items-start gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                {initials(contact?.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{contact?.full_name ?? '—'}</p>
                {contact?.email && <p className="text-xs text-slate-500 truncate">{contact.email}</p>}
                {contact?.phone && <p className="text-xs text-slate-400 truncate">{contact.phone}</p>}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {contact?.company?.name && (
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className="text-slate-400">🏢</span>
                  <span className="text-xs text-slate-700 truncate">{contact.company.name}</span>
                </div>
              )}
              {contact?.labels && contact.labels.length > 0 && (
                <div className="px-4 py-3 flex flex-wrap gap-1.5">
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
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{ticketCount} ticket{ticketCount === 1 ? '' : 's'} total</span>
                <button
                  onClick={() => navigate(`/contacts/${contactId}`)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  View contact →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent correspondence */}
      {contactId && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent correspondence</h3>
          </div>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-4">No correspondence yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((d: any) => (
                <button
                  key={d.id}
                  onClick={() => setOpenDraft(d)}
                  className="w-full text-left hover:bg-slate-50 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="text-xs text-slate-700 truncate">{draftSubject(d)}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(d.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Context scan */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Context scan</h3>
        </div>
        <div className="divide-y divide-slate-100">
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Subject</p>
            <p className="text-xs text-slate-700">{ticket?.subject ?? '—'}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Invoice #</p>
            {invoiceMatches.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {invoiceMatches.map(m => (
                  <span key={m} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">None found</p>
            )}
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Previous tickets</p>
            <p className="text-xs text-slate-700 mb-1.5">{priorCount} prior ticket{priorCount === 1 ? '' : 's'}</p>
            {priorSubjects.length > 0 && (
              <div className="flex flex-col gap-1">
                {priorSubjects.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className="text-left text-xs text-blue-600 hover:text-blue-700 truncate"
                  >
                    {t.subject}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {openDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
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
