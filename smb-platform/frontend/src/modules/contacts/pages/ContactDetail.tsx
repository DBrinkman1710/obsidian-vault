import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

function formatEventType(s: string): string {
  return s
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function payloadSummary(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null
  if (payload.subject) return payload.subject
  if (payload.comment) return String(payload.comment).slice(0, 80)
  if (payload.from_status && payload.to_status) return `${payload.from_status} → ${payload.to_status}`
  if (payload.status) return `Status: ${payload.status}`
  return null
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then(r => r.data),
  })

  const { data: activity } = useQuery({
    queryKey: ['contact-activity', id],
    queryFn: () => api.get(`/activity`, { params: { contact_id: id } }).then(r => r.data),
  })

  const { data: recentMoments } = useQuery({
    queryKey: ['contact-moments', id],
    queryFn: () => api.get(`/activity`, { params: { contact_id: id, limit: 3 } }).then(r => r.data),
  })

  if (isLoading) return <p>Loading...</p>
  if (!contact) return <p>Contact not found</p>

  const newTicketUrl = `/tickets/new?contact_id=${id}&contact_name=${encodeURIComponent(contact.full_name)}`

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

      {/* LEFT — contact info */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{contact.full_name}</h1>
          <Link to={newTicketUrl} style={{
            padding: '7px 16px', background: '#2563eb', color: '#fff',
            borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600,
          }}>
            + New Ticket
          </Link>
        </div>
        {contact.company && <p style={{ color: '#64748b', marginBottom: 24 }}>{contact.company}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          <Field label="Email" value={contact.email} />
          <Field label="Phone" value={contact.phone} />
          <Field label="Company" value={contact.company} />
          <Field label="Tags" value={contact.tags?.join(', ')} />
        </div>

        {contact.notes && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Notes</h3>
            <p style={{ color: '#475569', whiteSpace: 'pre-wrap' }}>{contact.notes}</p>
          </div>
        )}

        <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Activity</h3>
        {activity?.map((ev: any) => (
          <div key={ev.id} style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: 12, marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              <strong>{ev.event_type}</strong> · {new Date(ev.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* RIGHT — contact moments panel */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, color: '#64748b',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
        }}>
          Recent Contact Moments
        </p>

        {!recentMoments || recentMoments.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>No activity yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentMoments.map((ev: any) => {
              const summary = payloadSummary(ev.payload)
              return (
                <div key={ev.id} style={{
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 8, padding: 12,
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 8, marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>
                      {formatEventType(ev.event_type)}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(ev.created_at)}
                    </span>
                  </div>

                  <span style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 600,
                    color: '#475569', background: '#f1f5f9',
                    padding: '2px 7px', borderRadius: 10,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    marginBottom: summary ? 6 : 0,
                  }}>
                    {ev.module}
                  </span>

                  {summary && (
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.4, fontStyle: 'italic' }}>
                      {summary}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
      <p style={{ color: '#1e293b' }}>{value || '—'}</p>
    </div>
  )
}
