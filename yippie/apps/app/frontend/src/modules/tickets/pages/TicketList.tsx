import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, MessageSquare, Ticket } from 'lucide-react'
import { api } from '../../../api/client'
import { CardListSkeleton } from '../../../shell/Skeleton'

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  waiting:     'bg-violet-100 text-violet-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-slate-100 text-slate-600',
}

const PRIORITY_STYLES: Record<string, string> = {
  low:    'text-slate-500',
  medium: 'text-blue-600',
  high:   'text-amber-600',
  urgent: 'text-red-600',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function TicketList() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: () => api.get('/tickets', { params: { status: statusFilter || undefined } }).then(r => r.data),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
        <Link
          to="/tickets/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} />
          New Ticket
        </Link>
      </div>

      <select
        value={statusFilter}
        onChange={e => setStatusFilter(e.target.value)}
        className="mb-5 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="waiting">Waiting</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>

      {isLoading && <CardListSkeleton />}

      <div className="flex flex-col gap-3">
        {data?.items.map((t: any) => (
          <Link key={t.id} to={`/tickets/${t.id}`} className="block bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-slate-300 cursor-pointer transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {t.subject}
                  </span>
                  {t.department_name && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                      {t.department_name}
                    </span>
                  )}
                </div>
                {t.last_comment && (
                  <p className="text-xs text-slate-400 italic flex items-center gap-1.5 truncate">
                    <MessageSquare size={11} />
                    {t.last_comment.slice(0, 90)}{t.last_comment.length > 90 ? '…' : ''}
                    {t.last_comment_at && <span className="ml-1">· {timeAgo(t.last_comment_at)}</span>}
                  </p>
                )}
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 ${STATUS_STYLES[t.status]}`}>
                {t.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-slate-500 items-center">
              <span className={`font-semibold capitalize ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
              <span>{new Date(t.created_at).toLocaleDateString()}</span>
              {t.sla_due_at && (() => {
                const due = new Date(t.sla_due_at)
                const hoursLeft = (due.getTime() - Date.now()) / 3_600_000
                const overdue = hoursLeft < 0
                const urgent = hoursLeft >= 0 && hoursLeft <= 24
                return (
                  <span className={`font-semibold ${overdue ? 'text-red-600' : urgent ? 'text-orange-600' : ''}`}>
                    {overdue ? '⚠ Overdue' : urgent ? `⚠ SLA due ${due.toLocaleString()}` : `SLA: ${due.toLocaleString()}`}
                  </span>
                )
              })()}
            </div>
          </Link>
        ))}
      </div>

      {!isLoading && data?.items.length === 0 && (
        <div className="py-12 text-center">
          <Ticket size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No tickets found</p>
        </div>
      )}
    </div>
  )
}
