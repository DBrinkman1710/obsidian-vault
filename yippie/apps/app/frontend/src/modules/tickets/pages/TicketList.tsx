import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MessageSquare, Ticket, Trash2, X } from 'lucide-react'
import { api } from '../../../api/client'
import { CardListSkeleton } from '../../../shell/Skeleton'

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  waiting:     'bg-amber-100 text-amber-700',
  resolved:    'bg-green-100 text-green-700',
  closed:      'bg-slate-100 text-slate-600',
}

const STATUS_LABELS: Record<string, string> = {
  open:        'Open',
  in_progress: 'In progress',
  waiting:     'Waiting for customer',
  resolved:    'Resolved',
  closed:      'Closed',
}

// Badge styles — mirrors the inbox draft cards so the two lists look consistent.
const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low:    'bg-slate-100 text-slate-600',
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
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: () => api.get('/tickets', { params: { status: statusFilter || undefined } }).then(r => r.data),
  })

  const items: any[] = data?.items ?? []
  const allSelected = items.length > 0 && items.every((t: any) => selected.has(t.id))

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() { setSelected(allSelected ? new Set() : new Set(items.map((t: any) => t.id))) }
  function clearSelection() { setSelected(new Set()) }

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.delete('/tickets/bulk', { data: { ids } }),
    onSuccess: () => { clearSelection(); qc.invalidateQueries({ queryKey: ['tickets'] }) },
  })

  const selectedIds = [...selected]

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
        <option value="waiting">Waiting for customer</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-sm font-semibold text-blue-900">{selected.size} selected</span>
          <div className="h-4 w-px bg-blue-200" />
          <button
            onClick={() => {
              if (confirm(`Delete ${selected.size} ticket(s)? This cannot be undone.`))
                deleteMutation.mutate(selectedIds)
            }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            <Trash2 size={14} strokeWidth={2.5} /> Delete selected
          </button>
          <button onClick={clearSelection} className="ml-auto text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {isLoading && <CardListSkeleton />}

      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs text-slate-400 font-medium">Select all</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((t: any) => (
          <div key={t.id} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selected.has(t.id)}
              onChange={() => toggle(t.id)}
              onClick={e => e.stopPropagation()}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            />
            <Link
              to={`/tickets/${t.id}`}
              className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3 hover:border-blue-300 hover:shadow-md transition-all group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                    {t.subject}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_STYLES[t.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                    {t.priority}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[t.status] ?? t.status.replace('_', ' ')}
                  </span>
                  {t.department_name && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                      {t.department_name}
                    </span>
                  )}
                </div>
                {t.last_comment && (
                  <p className="text-xs text-slate-500 mb-1 line-clamp-2 italic flex items-start gap-1.5">
                    <MessageSquare size={11} className="mt-0.5 flex-shrink-0" />
                    <span>{t.last_comment.slice(0, 160)}{t.last_comment.length > 160 ? '…' : ''}</span>
                  </p>
                )}
                <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  {t.last_comment_at && <span>· {timeAgo(t.last_comment_at)}</span>}
                  {t.sla_due_at && (() => {
                    const due = new Date(t.sla_due_at)
                    const hoursLeft = (due.getTime() - Date.now()) / 3_600_000
                    const overdue = hoursLeft < 0
                    const urgent = hoursLeft >= 0 && hoursLeft <= 24
                    return (
                      <span className={`font-semibold ${overdue ? 'text-red-600' : urgent ? 'text-orange-600' : 'text-slate-400'}`}>
                        · {overdue ? '⚠ Overdue' : urgent ? `⚠ SLA due ${due.toLocaleString()}` : `SLA: ${due.toLocaleString()}`}
                      </span>
                    )
                  })()}
                </p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {!isLoading && items.length === 0 && (
        <div className="py-12 text-center">
          <Ticket size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No tickets found</p>
        </div>
      )}
    </div>
  )
}
