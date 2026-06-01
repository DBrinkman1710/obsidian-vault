import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
}

const STATUS_COLORS: Record<string, string> = {
  open: '#3b82f6',
  pending: '#f97316',
  waiting: '#8b5cf6',
  resolved: '#22c55e',
  closed: '#94a3b8',
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: color + '22', color,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  )
}

export default function DraftReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: ctx, isLoading } = useQuery({
    queryKey: ['draft', id],
    queryFn: () => api.get(`/inbox/drafts/${id}`).then(r => r.data),
  })

  const draft = ctx?.draft
  const msg = ctx?.inbound_message
  const contact = ctx?.contact
  const recentTickets: any[] = ctx?.recent_tickets ?? []
  const billing = ctx?.billing

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

  if (isLoading || !draft) return <p style={{ padding: 32 }}>Loading...</p>

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', minHeight: 0 }}>

      {/* LEFT — Context window */}
      <div style={{
        width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Context Window
        </h2>

        {/* AI briefing */}
        {draft.context_summary && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Briefing
            </p>
            <p style={{ fontSize: 13, color: '#1e3a5f', lineHeight: 1.6, margin: 0 }}>
              {draft.context_summary}
            </p>
          </div>
        )}

        {/* Contact card */}
        {contact ? (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Customer
            </p>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>{contact.full_name}</p>
            {contact.company && <p style={{ fontSize: 13, color: '#475569', marginBottom: 2 }}>{contact.company}</p>}
            {contact.email && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{contact.email}</p>}
            {contact.phone && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{contact.phone}</p>}
            {contact.tags && contact.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {contact.tags.map((t: string) => (
                  <span key={t} style={{
                    background: '#f1f5f9', color: '#475569', fontSize: 11,
                    padding: '2px 8px', borderRadius: 10,
                  }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: 12 }}>
            <p style={{ fontSize: 13, color: '#78350f', margin: 0 }}>
              Unknown sender — no matching contact found.
            </p>
          </div>
        )}

        {/* Billing */}
        {billing && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Subscription
            </p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{billing.plan_name}</p>
            <p style={{ fontSize: 13, color: '#475569', marginBottom: 2 }}>
              {(billing.amount_cents / 100).toFixed(2)} {billing.currency} / {billing.billing_cycle}
            </p>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Status: <strong style={{ color: billing.status === 'active' ? '#16a34a' : '#ef4444' }}>{billing.status}</strong>
            </p>
          </div>
        )}

        {/* Recent tickets */}
        {recentTickets.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Tickets
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentTickets.map((t: any) => (
                <div key={t.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
                  <p style={{ fontSize: 13, color: '#1e293b', margin: '0 0 4px', fontWeight: 500, lineHeight: 1.3 }}>{t.subject}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Badge label={t.status} color={STATUS_COLORS[t.status] ?? '#64748b'} />
                    <Badge label={t.priority} color={PRIORITY_COLORS[t.priority] ?? '#64748b'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw message */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Original Message
            {msg?.source && (
              <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 400, textTransform: 'none' }}>
                via {msg.source}
              </span>
            )}
          </p>
          {msg?.subject && (
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>{msg.subject}</p>
          )}
          <p style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>
            {msg?.raw_body}
          </p>
        </div>
      </div>

      {/* RIGHT — Review form */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Review Draft</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>Edit the AI-suggested fields, then approve or reject.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Subject</label>
            <input
              value={subject || draft.ai_suggested_subject}
              onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea
              rows={6}
              value={description || draft.ai_suggested_description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>Priority</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                const active = (priority || draft.ai_suggested_priority) === p
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    style={{
                      padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', textTransform: 'capitalize',
                      background: active ? PRIORITY_COLORS[p] : '#f1f5f9',
                      color: active ? '#fff' : '#475569',
                      border: active ? `2px solid ${PRIORITY_COLORS[p]}` : '2px solid transparent',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
            {draft.ai_suggested_category && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                AI category: <strong>{draft.ai_suggested_category}</strong>
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => reviewMutation.mutate('approve')}
            disabled={reviewMutation.isPending}
            style={{
              padding: '10px 28px', background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            Approve & Create Ticket
          </button>
          <button
            onClick={() => reviewMutation.mutate('reject')}
            disabled={reviewMutation.isPending}
            style={{
              padding: '10px 24px', background: '#fff', color: '#ef4444',
              border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 14,
            }}
          >
            Reject
          </button>
          <button
            onClick={() => navigate('/inbox')}
            style={{
              padding: '10px 20px', background: '#f1f5f9', color: '#475569',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            }}
          >
            Back to Inbox
          </button>
        </div>
      </div>
    </div>
  )
}
