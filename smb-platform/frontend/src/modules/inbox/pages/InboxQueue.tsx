import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

const SOURCE_ICON: Record<string, string> = { email: '✉️', whatsapp: '💬' }
const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#6b7280',
}

type Tab = 'pending' | 'processed'

export default function InboxQueue() {
  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const { data: pendingDrafts, isLoading: pendingLoading } = useQuery({
    queryKey: ['drafts', 'pending'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'pending' } }).then(r => r.data),
    refetchInterval: 15_000,
    enabled: activeTab === 'pending',
  })

  const { data: approvedDrafts } = useQuery({
    queryKey: ['drafts', 'approved'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'approved' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: rejectedDrafts } = useQuery({
    queryKey: ['drafts', 'rejected'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'rejected' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: forwardedDrafts } = useQuery({
    queryKey: ['drafts', 'forwarded'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'forwarded' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const processedDrafts = [...(approvedDrafts ?? []), ...(rejectedDrafts ?? []), ...(forwardedDrafts ?? [])]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const drafts = activeTab === 'pending' ? pendingDrafts : processedDrafts
  const isLoading = activeTab === 'pending' ? pendingLoading : false

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', border: active ? '2px solid #2563eb' : '2px solid transparent',
    background: active ? '#2563eb' : '#f1f5f9',
    color: active ? '#fff' : '#475569',
  })

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Inbox</h1>
      <p style={{ color: '#64748b', marginBottom: 16 }}>
        Messages from email and WhatsApp — review AI drafts before creating tickets.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button style={tabStyle(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
          Pending
        </button>
        <button style={tabStyle(activeTab === 'processed')} onClick={() => setActiveTab('processed')}>
          Processed
        </button>
      </div>

      {isLoading && <p>Loading...</p>}
      {!isLoading && drafts?.length === 0 && (
        <p style={{ color: '#94a3b8' }}>
          {activeTab === 'pending' ? 'No pending drafts.' : 'No processed drafts yet.'}
        </p>
      )}

      {drafts?.map((d: any) => {
        const isFollowUp = d.status === 'approved' && d.follow_up_at
        const statusColor = d.status === 'approved' ? '#16a34a' : d.status === 'rejected' ? '#ef4444' : null
        return (
          <div key={d.id} style={{
            border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px',
            marginBottom: 12, background: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span>{SOURCE_ICON[d.source] ?? '📨'}</span>
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
                {d.status === 'forwarded' ? (
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 12,
                    background: '#f5f3ff', color: '#7c3aed',
                  }}>
                    Forwarded
                  </span>
                ) : statusColor ? (
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 12,
                    background: statusColor + '20', color: statusColor, textTransform: 'capitalize',
                  }}>
                    {d.status}
                  </span>
                ) : null}
                {isFollowUp && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '1px 8px', borderRadius: 12,
                    background: '#f97316' + '20', color: '#f97316',
                  }}>
                    Follow-up
                  </span>
                )}
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                {d.ai_suggested_description.slice(0, 120)}...
              </p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(d.created_at).toLocaleString()}</p>
            </div>
            <Link
              to={`/inbox/drafts/${d.id}`}
              style={{
                padding: '6px 16px', background: '#2563eb', color: '#fff',
                borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                whiteSpace: 'nowrap', marginLeft: 16, flexShrink: 0,
              }}
            >
              {activeTab === 'processed' ? 'Open' : 'Review'}
            </Link>
          </div>
        )
      })}
    </div>
  )
}
