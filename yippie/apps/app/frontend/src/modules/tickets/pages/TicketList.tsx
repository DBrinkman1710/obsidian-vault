import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Ticket, Trash2, UserPlus, Check, Archive } from 'lucide-react'
import { api } from '../../../api/client'
import { CardListSkeleton } from '../../../shell/Skeleton'
import { useAuth } from '../../../auth/useAuth'
import { useState } from 'react'
import { useSelection, Checkbox, BulkBar } from '../../../components/Selection'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
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

export default function TicketList() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [assignedToMe, setAssignedToMe] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter, assignedToMe],
    queryFn: () => api.get('/tickets', {
      params: {
        status: statusFilter || undefined,
        assigned_to: assignedToMe && user?.id ? user.id : undefined,
      },
    }).then(r => r.data),
  })

  const items: any[] = data?.items ?? []
  const ids = items.map((t: any) => t.id)
  const selection = useSelection(ids)
  const ctx = useContextMenu()

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.delete('/tickets/bulk', { data: { ids } }),
    onSuccess: () => { selection.clear(); qc.invalidateQueries({ queryKey: ['tickets'] }) },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/tickets/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })

  const assignMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tickets/${id}`, { assigned_to: user?.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-[26px] tracking-tight" style={{ color: 'var(--ink)' }}>
          Tickets
        </h1>
        <Link
          to="/tickets/new"
          className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold transition-all"
          style={{ background: 'var(--ink)', borderRadius: 'var(--radius-sm)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.boxShadow = 'var(--shadow-brand)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <Plus size={15} strokeWidth={2.5} />
          New Ticket
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border text-sm bg-white outline-none"
          style={{ borderRadius: 'var(--radius-sm)', borderColor: 'var(--border-default)', color: 'var(--text-body)' }}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="waiting">Waiting for customer</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <BulkBar
        count={selection.count}
        onClear={selection.clear}
        actions={[
          {
            label: 'Delete',
            icon: <Trash2 size={13} />,
            danger: true,
            onClick: () => {
              if (confirm(`Delete ${selection.count} ticket(s)? This cannot be undone.`))
                deleteMutation.mutate([...selection.sel])
            },
          },
        ]}
      />

      {isLoading && <CardListSkeleton />}

      {items.length > 0 && (
        <div className="flex items-center gap-3 mb-2 py-2 bg-slate-50">
          <button
            type="button"
            onClick={selection.toggleAll}
            className="inline-flex items-center gap-2 text-xs font-medium transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <Checkbox
              checked={selection.all}
              indeterminate={selection.some}
              onChange={selection.toggleAll}
              ariaLabel="Select all tickets"
            />
            {selection.all ? 'Deselect all' : `Select all (${items.length})`}
          </button>
          <button
            type="button"
            onClick={() => setAssignedToMe(v => !v)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold transition-colors"
            style={{
              borderRadius: 'var(--radius-sm)',
              background: assignedToMe ? 'var(--brand-soft)' : 'transparent',
              color: assignedToMe ? 'var(--brand-deep)' : 'var(--text-muted)',
            }}
          >
            Assigned to me
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map((t: any) => {
          const statusStyle = STATUS_STYLES[t.status] ?? { bg: 'var(--slate-100)', color: 'var(--slate-500)' }
          const priorityStyle = PRIORITY_STYLES[t.priority] ?? { bg: 'var(--slate-100)', color: 'var(--slate-500)' }
          const isSelected = selection.has(t.id)
          return (
            <div
              key={t.id}
              className="border p-4 flex items-start gap-3 transition-all"
              style={{
                borderRadius: 'var(--radius-md)',
                borderColor: isSelected ? 'var(--brand-ring)' : 'var(--border-default)',
                background: isSelected ? 'rgba(91,164,245,0.08)' : '#fff',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--brand-ring)' }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)' }}
              onContextMenu={e => ctx.open(e, [
                { header: t.subject.length > 32 ? t.subject.slice(0, 32) + '…' : t.subject },
                { label: 'Assign to me', icon: <UserPlus size={14} />, onClick: () => assignMutation.mutate(t.id) },
                { separator: true },
                { label: 'Mark resolved', icon: <Check size={14} />, onClick: () => statusMutation.mutate({ id: t.id, status: 'resolved' }) },
                { label: 'Close ticket', icon: <Archive size={14} />, onClick: () => statusMutation.mutate({ id: t.id, status: 'closed' }) },
                { separator: true },
                {
                  label: 'Delete',
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onClick: () => {
                    if (confirm('Delete this ticket? This cannot be undone.'))
                      deleteMutation.mutate([t.id])
                  },
                },
              ])}
            >
              <span className="shrink-0 mt-0.5" onClick={e => e.preventDefault()}>
                <Checkbox
                  checked={isSelected}
                  onChange={e => selection.toggle(t.id, e)}
                  ariaLabel={`Select ticket ${t.subject}`}
                />
              </span>
              <Link to={`/tickets/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t.subject}</span>
                  <Badge bg={priorityStyle.bg} color={priorityStyle.color}>{t.priority}</Badge>
                  <Badge bg={statusStyle.bg} color={statusStyle.color}>{STATUS_LABELS[t.status] ?? t.status}</Badge>
                  {t.department_name && (
                    <Badge bg="var(--slate-100)" color="var(--text-subtle)">{t.department_name}</Badge>
                  )}
                </div>
                <p className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  {t.last_comment_at && <span>· {timeAgo(t.last_comment_at)}</span>}
                  {t.sla_due_at && (() => {
                    const due = new Date(t.sla_due_at)
                    const hoursLeft = (due.getTime() - Date.now()) / 3_600_000
                    const overdue = hoursLeft < 0
                    const urgent = hoursLeft >= 0 && hoursLeft <= 24
                    return (
                      <span
                        className="font-semibold"
                        style={{ color: overdue ? 'var(--status-urgent)' : urgent ? 'var(--status-high)' : 'var(--text-muted)' }}
                      >
                        · {overdue ? '⚠ Overdue' : urgent ? `⚠ SLA due ${due.toLocaleString()}` : `SLA: ${due.toLocaleString()}`}
                      </span>
                    )
                  })()}
                </p>
              </Link>
            </div>
          )
        })}
      </div>

      {!isLoading && items.length === 0 && (
        <div className="py-12 text-center">
          <Ticket size={32} className="mx-auto mb-3" style={{ color: 'var(--border-strong)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No tickets found</p>
        </div>
      )}

      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </div>
  )
}
