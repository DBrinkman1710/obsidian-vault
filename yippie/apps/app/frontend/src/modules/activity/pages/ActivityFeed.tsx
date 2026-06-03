import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

const STAT_CARDS = [
  { key: 'open',        label: 'Open',              color: '#2563eb', bg: '#eff6ff' },
  { key: 'in_progress', label: 'Active',             color: '#7c3aed', bg: '#f5f3ff' },
  { key: 'waiting',     label: 'Ready to inform',    color: '#d97706', bg: '#fffbeb' },
]

export default function ActivityFeed() {
  const { data: stats } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: () => api.get('/activity/stats').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: events, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get('/activity').then(r => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Activity</h1>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {STAT_CARDS.map(({ key, label, color, bg }) => (
          <div key={key} style={{
            flex: 1, background: bg, border: `1px solid ${color}30`,
            borderRadius: 10, padding: '20px 24px',
          }}>
            <p style={{ fontSize: 36, fontWeight: 800, color, margin: 0, lineHeight: 1 }}>
              {stats?.[key] ?? '—'}
            </p>
            <p style={{ fontSize: 13, fontWeight: 600, color, margin: '6px 0 0', opacity: 0.8 }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Event feed */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
        Recent Events
      </h2>
      {isLoading && <p>Loading...</p>}
      {events?.length === 0 && <p style={{ color: '#94a3b8' }}>No activity yet.</p>}
      {events?.map((ev: any) => (
        <div key={ev.id} style={{
          display: 'flex', gap: 16, padding: '12px 0', borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#2563eb',
            marginTop: 6, flexShrink: 0,
          }} />
          <div>
            <p style={{ fontSize: 14, color: '#1e293b' }}>
              <strong>{ev.event_type}</strong> on {ev.entity_type}
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {new Date(ev.created_at).toLocaleString()}
              {ev.module && ` · ${ev.module}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
