import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

export default function DraftReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: draft, isLoading } = useQuery({
    queryKey: ['draft', id],
    queryFn: () => api.get(`/inbox/drafts/${id}`).then(r => r.data),
  })

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('')

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      api.post(`/inbox/drafts/${id}/review`, {
        action,
        subject: subject || draft?.ai_suggested_subject,
        description: description || draft?.ai_suggested_description,
        priority: priority || draft?.ai_suggested_priority,
      }),
    onSuccess: (_, action) => {
      qc.invalidateQueries({ queryKey: ['drafts'] })
      if (action === 'approve') navigate('/tickets')
      else navigate('/inbox')
    },
  })

  if (isLoading || !draft) return <p>Loading...</p>

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Review Draft</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>Edit the AI-suggested fields, then approve or reject.</p>

      <div style={{ background: '#f1f5f9', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>ORIGINAL MESSAGE</p>
        <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', color: '#1e293b' }}>
          {draft.ai_suggested_description}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Subject</label>
          <input
            value={subject || draft.ai_suggested_subject}
            onChange={e => setSubject(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            rows={5} value={description || draft.ai_suggested_description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, resize: 'vertical' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Priority</label>
          <select
            value={priority || draft.ai_suggested_priority}
            onChange={e => setPriority(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <span style={{ marginLeft: 12, fontSize: 13, color: '#94a3b8' }}>
            AI suggested: <strong>{draft.ai_suggested_priority}</strong>
            {draft.ai_suggested_category && ` · ${draft.ai_suggested_category}`}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => reviewMutation.mutate('approve')}
          disabled={reviewMutation.isPending}
          style={{
            padding: '10px 24px', background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}>
          Approve & Create Ticket
        </button>
        <button onClick={() => reviewMutation.mutate('reject')}
          disabled={reviewMutation.isPending}
          style={{
            padding: '10px 24px', background: '#f8fafc', color: '#ef4444',
            border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          }}>
          Reject
        </button>
      </div>
    </div>
  )
}
