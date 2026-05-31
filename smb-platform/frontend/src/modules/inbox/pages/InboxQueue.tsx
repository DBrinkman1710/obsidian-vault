import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

const SOURCE_ICON: Record<string, string> = { email: '✉️', whatsapp: '💬' }
const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#6b7280',
}

export default function InboxQueue() {
  const { data: drafts, isLoading } = useQuery({
    queryKey: ['drafts', 'pending'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'pending' } }).then(r => r.data),
    refetchInterval: 15_000,
  })

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Inbox</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Messages from email and WhatsApp — review AI drafts before creating tickets.
      </p>

      {isLoading && <p>Loading...</p>}
      {drafts?.length === 0 && <p style={{ color: '#94a3b8' }}>No pending drafts.</p>}

      {drafts?.map((d: any) => (
        <div key={d.id} style={{
          border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px',
          marginBottom: 12, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span>{SOURCE_ICON[d.inbound_message?.source] ?? '📨'}</span>
              <span style={{ fontWeight: 600 }}>{d.ai_suggested_subject}</span>
              <span style={{
                padding: '1px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: PRIORITY_COLOR[d.ai_suggested_priority] + '20',
                color: PRIORITY_COLOR[d.ai_suggested_priority],
              }}>
                {d.ai_suggested_priority}
              </span>
              {d.ai_suggested_category && (
                <span style={{ fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '1px 8px', borderRadius: 12 }}>
                  {d.ai_suggested_category}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{d.ai_suggested_description.slice(0, 120)}...</p>
            <p style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(d.created_at).toLocaleString()}</p>
          </div>
          <Link to={`/inbox/drafts/${d.id}`} style={{
            padding: '6px 16px', background: '#2563eb', color: '#fff',
            borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            Review
          </Link>
        </div>
      ))}
    </div>
  )
}
