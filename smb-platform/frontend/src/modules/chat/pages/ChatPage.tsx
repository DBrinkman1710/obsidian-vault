import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

function formatTime(dt: string) {
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ChatPage() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['chat-sessions'],
    queryFn: () => api.get('/chat/sessions').then(r => r.data),
    refetchInterval: 15_000,
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Live Chat</h1>
          <p style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>
            Real-time chat sessions from your embedded widget
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20,
          padding: '6px 14px', fontSize: 13, color: '#16a34a', fontWeight: 600,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
          Live
        </div>
      </div>

      {isLoading && <p style={{ color: '#94a3b8' }}>Loading sessions...</p>}

      {!isLoading && sessions.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '64px 32px', background: '#f8fafc',
          borderRadius: 12, border: '1px dashed #cbd5e1',
        }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>💬</p>
          <p style={{ fontWeight: 600, color: '#334155', marginBottom: 6 }}>No active chat sessions</p>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            Embed the chat widget on your website to start receiving live chats.
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 16, fontFamily: 'monospace' }}>
            {`<script src="${window.location.origin}/widget.js"></script>`}
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((s: any) => (
            <div
              key={s.id}
              style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', margin: '0 0 4px' }}>
                  {s.visitor_name || 'Anonymous visitor'}
                  {s.visitor_email && (
                    <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 8, fontSize: 13 }}>
                      {s.visitor_email}
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                  Started {formatTime(s.started_at)}
                  {s.ended_at && ` · Ended ${formatTime(s.ended_at)}`}
                </p>
              </div>
              <div style={{
                padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: s.ended_at ? '#f1f5f9' : '#f0fdf4',
                color: s.ended_at ? '#64748b' : '#16a34a',
              }}>
                {s.ended_at ? 'Ended' : 'Active'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
