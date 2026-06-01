import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

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

  if (isLoading) return <p>Loading...</p>
  if (!contact) return <p>Contact not found</p>

  const newTicketUrl = `/tickets/new?contact_id=${id}&contact_name=${encodeURIComponent(contact.full_name)}`

  return (
    <div style={{ maxWidth: 720 }}>
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
