import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

const STATUS_COLORS: Record<string, string> = {
  open: '#2563eb', in_progress: '#d97706', waiting: '#7c3aed',
  resolved: '#16a34a', closed: '#6b7280',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6b7280', medium: '#2563eb', high: '#d97706', urgent: '#dc2626',
}

export default function TicketList() {
  const [statusFilter, setStatusFilter] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', statusFilter],
    queryFn: () => api.get('/tickets', { params: { status: statusFilter || undefined } }).then(r => r.data),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Tickets</h1>
        <Link to="/tickets/new" style={{
          padding: '8px 16px', background: '#2563eb', color: '#fff',
          borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600,
        }}>+ New Ticket</Link>
      </div>

      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 20, fontSize: 14 }}>
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="in_progress">In progress</option>
        <option value="waiting">Waiting</option>
        <option value="resolved">Resolved</option>
        <option value="closed">Closed</option>
      </select>

      {isLoading && <p>Loading...</p>}
      {data?.items.map((t: any) => (
        <div key={t.id} style={{
          border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px',
          marginBottom: 12, background: '#fff',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Link to={`/tickets/${t.id}`} style={{ color: '#1e293b', textDecoration: 'none', fontWeight: 600, fontSize: 15 }}>
              {t.subject}
            </Link>
            <span style={{
              padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              background: STATUS_COLORS[t.status] + '20', color: STATUS_COLORS[t.status],
            }}>
              {t.status.replace('_', ' ')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: '#64748b' }}>
            <span style={{ color: PRIORITY_COLORS[t.priority], fontWeight: 600 }}>{t.priority}</span>
            <span>{new Date(t.created_at).toLocaleDateString()}</span>
            {t.sla_due_at && <span>SLA: {new Date(t.sla_due_at).toLocaleString()}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
