import { useQuery } from '@tanstack/react-query'
import { X, UserCircle, ExternalLink, Clock } from 'lucide-react'
import { api } from '../api/client'

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  open:        { bg: 'var(--status-info-bg)',    color: 'var(--status-info)' },
  in_progress: { bg: 'var(--status-high-bg)',    color: 'var(--status-high)' },
  waiting:     { bg: 'var(--status-waiting-bg)', color: 'var(--status-waiting)' },
  resolved:    { bg: 'var(--status-success-bg)', color: 'var(--status-success)' },
  closed:      { bg: 'var(--slate-100)',          color: 'var(--slate-500)' },
}

const STATUS_LABELS: Record<string, string> = {
  open:        'Open',
  in_progress: 'In progress',
  waiting:     'Waiting',
  resolved:    'Resolved',
  closed:      'Closed',
}

const PRIORITY_STYLES: Record<string, { bg: string; color: string }> = {
  urgent: { bg: 'var(--status-urgent-bg)', color: 'var(--status-urgent)' },
  high:   { bg: 'var(--status-high-bg)',   color: 'var(--status-high)' },
  medium: { bg: 'var(--status-info-bg)',   color: 'var(--status-info)' },
  low:    { bg: 'var(--slate-100)',         color: 'var(--slate-500)' },
}

interface TicketPeekModalProps {
  ticketId: string | number | null
  onClose: () => void
}

function Badge({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  )
}

export default function TicketPeekModal({ ticketId, onClose }: TicketPeekModalProps) {
  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', String(ticketId)],
    queryFn: () => api.get(`/tickets/${ticketId}`).then(r => r.data),
    enabled: ticketId !== null,
  })

  if (ticketId === null) return null

  const statusStyle = ticket ? (STATUS_STYLES[ticket.status] ?? { bg: 'var(--slate-100)', color: 'var(--slate-500)' }) : null
  const priorityStyle = ticket ? (PRIORITY_STYLES[ticket.priority] ?? { bg: 'var(--slate-100)', color: 'var(--slate-500)' }) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {isLoading && (
          <div className="flex flex-col gap-4 animate-pulse pr-6">
            <div className="h-5 bg-slate-200 rounded w-3/4" />
            <div className="flex gap-2">
              <div className="h-4 bg-slate-100 rounded-full w-16" />
              <div className="h-4 bg-slate-100 rounded-full w-14" />
            </div>
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
          </div>
        )}

        {!isLoading && ticket && (
          <>
            {/* Subject */}
            <h2 className="text-lg font-bold text-slate-900 pr-6 mb-3 leading-snug">
              {ticket.subject}
            </h2>

            {/* Status + Priority badges */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              {statusStyle && (
                <Badge bg={statusStyle.bg} color={statusStyle.color}>
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </Badge>
              )}
              {priorityStyle && (
                <Badge bg={priorityStyle.bg} color={priorityStyle.color}>
                  {ticket.priority}
                </Badge>
              )}
            </div>

            {/* Assigned to */}
            {ticket.assigned_to_name && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-slate-600">
                <UserCircle size={13} className="text-slate-400 shrink-0" />
                <span>{ticket.assigned_to_name}</span>
              </div>
            )}

            {/* Description */}
            {ticket.description && (
              <p className="text-sm text-slate-600 mb-4 line-clamp-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 whitespace-pre-wrap">
                {ticket.description.length > 200
                  ? ticket.description.slice(0, 200) + '…'
                  : ticket.description}
              </p>
            )}

            {/* Created at */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
              <Clock size={12} className="shrink-0" />
              <span>{new Date(ticket.created_at).toLocaleString()}</span>
            </div>

            <hr className="border-slate-100 mb-4" />

            {/* Footer */}
            <div className="flex justify-end">
              <button
                onClick={() => window.open(`/tickets/${ticketId}`, '_blank')}
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
