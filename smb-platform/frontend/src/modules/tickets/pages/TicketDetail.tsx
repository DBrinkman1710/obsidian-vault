import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
  })
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => api.get(`/tickets/${id}/comments`).then(r => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/tickets/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/comments`, { body: comment, is_internal: isInternal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-comments', id] })
      setComment('')
    },
  })

  if (!ticket) return <p>Loading...</p>

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{ticket.subject}</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, fontSize: 13 }}>
        <span>Status: <strong>{ticket.status}</strong></span>
        <span>Priority: <strong>{ticket.priority}</strong></span>
        <span>Source: <strong>{ticket.source}</strong></span>
      </div>

      {ticket.description && (
        <p style={{ color: '#475569', marginBottom: 24, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {['open', 'in_progress', 'waiting', 'resolved', 'closed'].map(s => (
          <button key={s} onClick={() => statusMutation.mutate(s)}
            style={{
              padding: '4px 12px', borderRadius: 16, border: '1px solid #cbd5e1',
              background: ticket.status === s ? '#2563eb' : '#f8fafc',
              color: ticket.status === s ? '#fff' : '#475569',
              cursor: 'pointer', fontSize: 13,
            }}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Comments</h3>
      {comments?.map((c: any) => (
        <div key={c.id} style={{
          background: c.is_internal ? '#fefce8' : '#f8fafc',
          border: `1px solid ${c.is_internal ? '#fef08a' : '#e2e8f0'}`,
          borderRadius: 8, padding: '12px 16px', marginBottom: 10,
        }}>
          {c.is_internal && <p style={{ fontSize: 11, color: '#ca8a04', fontWeight: 600, marginBottom: 4 }}>INTERNAL NOTE</p>}
          <p style={{ color: '#1e293b', whiteSpace: 'pre-wrap' }}>{c.body}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{new Date(c.created_at).toLocaleString()}</p>
        </div>
      ))}

      <div style={{ marginTop: 20 }}>
        <textarea
          value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Write a reply or note..."
          rows={4}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} />
            Internal note (not visible to customer)
          </label>
          <button onClick={() => commentMutation.mutate()} disabled={!comment.trim()}
            style={{
              padding: '8px 20px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
