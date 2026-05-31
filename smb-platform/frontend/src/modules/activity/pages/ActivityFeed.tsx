import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

export default function ActivityFeed() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => api.get('/activity').then(r => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Activity Feed</h1>
      {isLoading && <p>Loading...</p>}
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
