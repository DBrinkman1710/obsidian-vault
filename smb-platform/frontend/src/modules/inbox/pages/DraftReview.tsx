import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  in_progress: '#8b5cf6',
  waiting: '#f97316',
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

function guessNameFromEmail(email: string): string {
  const prefix = email.split('@')[0]
  return prefix.replace(/[._\-+]/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4,
}

interface NewContactModalProps {
  senderEmail: string
  draftId: string
  onSuccess: () => void
  onDismiss: () => void
}

function NewContactModal({ senderEmail, draftId, onSuccess, onDismiss }: NewContactModalProps) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    full_name: guessNameFromEmail(senderEmail),
    email: senderEmail,
    phone: '', company: '', tags: '', notes: '',
  })
  const [error, setError] = useState('')

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  const mutation = useMutation({
    mutationFn: async () => {
      const contactRes = await api.post('/contacts', {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        notes: form.notes.trim() || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null,
      })
      await api.post(`/inbox/drafts/${draftId}/link-contact`, { contact_id: contactRes.data.id })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['draft', draftId] })
      onSuccess()
    },
    onError: () => setError('Something went wrong — try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Name is required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Unknown Sender</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          No contact found for <strong>{senderEmail}</strong>. Add them to continue.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Full name *</label>
            <input style={inputStyle} value={form.full_name} onChange={set('full_name')} autoFocus />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={set('phone')} placeholder="+31 6 00000000" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Company</label>
            <input style={inputStyle} value={form.company} onChange={set('company')} placeholder="Acme BV" />
          </div>
          <div>
            <label style={labelStyle}>Tags <span style={{ fontWeight: 400, color: '#94a3b8' }}>(comma-separated)</span></label>
            <input style={inputStyle} value={form.tags} onChange={set('tags')} placeholder="vip, enterprise" />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
              value={form.notes} onChange={set('notes')} placeholder="Any context about this contact..."
            />
          </div>
          {error && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" disabled={mutation.isPending} style={{
              padding: '9px 20px', background: mutation.isPending ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 6,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 14,
            }}>
              {mutation.isPending ? 'Saving…' : 'Create & Link Contact'}
            </button>
            <button type="button" onClick={onDismiss} style={{
              padding: '9px 16px', background: '#f1f5f9', color: '#475569',
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            }}>
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
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

  const ticketId = draft?.approved_ticket_id
  const { data: linkedTicket } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.get(`/tickets/${ticketId}`).then(r => r.data),
    enabled: !!ticketId,
  })

  const isProcessed = draft?.status !== 'pending'
  const isFollowUp = draft?.status === 'approved' && !!draft?.follow_up_at
  const isForwarded = draft?.status === 'forwarded'
  const isResolved = linkedTicket?.status === 'closed' || linkedTicket?.status === 'resolved'

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
    enabled: !isProcessed,
  })

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('')
  const [followUpDays, setFollowUpDays] = useState('')
  const [selectedDeptId, setSelectedDeptId] = useState('')
  const [forwardLoading, setForwardLoading] = useState(false)
  const [forwardedToName, setForwardedToName] = useState('')
  const [modalDismissed, setModalDismissed] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [improveLoading, setImproveLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ label: string; revised_text: string }>>([])
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [sendError, setSendError] = useState('')

  const showContactModal = !isLoading && !!ctx && !ctx.contact && !modalDismissed && !isProcessed

  const reviewMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      api.post(`/inbox/drafts/${id}/review`, {
        action,
        subject: subject || draft?.ai_suggested_subject,
        description: description || draft?.ai_suggested_description,
        priority: priority || draft?.ai_suggested_priority,
        follow_up_days: followUpDays ? parseInt(followUpDays) : undefined,
      }),
    onSuccess: (_, action) => {
      qc.invalidateQueries({ queryKey: ['drafts'] })
      if (action === 'approve') navigate('/inbox')
      else navigate('/inbox')
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => api.patch(`/tickets/${ticketId}/status`, { status: 'open' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticketId] }),
  })

  const clearFollowUpMutation = useMutation({
    mutationFn: () => api.post(`/inbox/drafts/${id}/clear-followup`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drafts'] })
      navigate('/inbox')
    },
  })

  async function handleForward() {
    if (!selectedDeptId) return
    setForwardLoading(true)
    try {
      const res = await api.post(`/inbox/drafts/${id}/forward`, { department_id: selectedDeptId })
      setReplyText(res.data.suggestion)
      setForwardedToName(res.data.department.name)
      qc.invalidateQueries({ queryKey: ['drafts'] })
      qc.invalidateQueries({ queryKey: ['draft', id] })
      setSuggestions([])
    } finally {
      setForwardLoading(false)
    }
  }

  async function handleGenerateReply() {
    setReplyLoading(true)
    try {
      const res = await api.post(`/inbox/drafts/${id}/suggest-reply`)
      setReplyText(res.data.suggestion)
      setSuggestions([])
    } finally {
      setReplyLoading(false)
    }
  }

  async function handleImproveReply() {
    if (!replyText.trim()) return
    setImproveLoading(true)
    try {
      const res = await api.post(`/inbox/drafts/${id}/improve-reply`, { current_text: replyText })
      setSuggestions(res.data.suggestions)
    } finally {
      setImproveLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(replyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSendReply() {
    if (!replyText.trim()) return
    setSending(true)
    setSendError('')
    try {
      const res = await api.post(`/inbox/drafts/${id}/send-reply`, { reply_text: replyText })
      setSentTo(res.data.to)
      qc.invalidateQueries({ queryKey: ['contact-activity'] })
      qc.invalidateQueries({ queryKey: ['contact-moments'] })
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setSendError(detail || 'Failed to send — check Mailgun configuration.')
    } finally {
      setSending(false)
    }
  }

  if (isLoading || !draft) return <p style={{ padding: 32 }}>Loading...</p>

  return (
    <>
      {showContactModal && msg && (
        <NewContactModal
          senderEmail={msg.sender}
          draftId={id!}
          onSuccess={() => setModalDismissed(true)}
          onDismiss={() => setModalDismissed(true)}
        />
      )}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', minHeight: 0 }}>

        {/* LEFT — Context window (same in all modes) */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            Context Window
          </h2>

          {contact ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 4 }}>{contact.full_name}</p>
              {contact.company && <p style={{ fontSize: 13, color: '#475569', marginBottom: 2 }}>{contact.company}</p>}
              {contact.email && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{contact.email}</p>}
              {contact.phone && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{contact.phone}</p>}
              {contact.tags && contact.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {contact.tags.map((t: string) => (
                    <span key={t} style={{ background: '#f1f5f9', color: '#475569', fontSize: 11, padding: '2px 8px', borderRadius: 10 }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#fef9c3', border: '1px solid #fde047', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 13, color: '#78350f', margin: '0 0 8px' }}>Unknown sender — no matching contact found.</p>
              {!isProcessed && (
                <button onClick={() => setModalDismissed(false)} style={{
                  fontSize: 12, fontWeight: 600, color: '#92400e', background: '#fde68a',
                  border: '1px solid #fcd34d', borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
                }}>
                  + Add to Contacts
                </button>
              )}
            </div>
          )}

          {draft.context_summary && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI Briefing
              </p>
              <p style={{ fontSize: 13, color: '#1e3a5f', lineHeight: 1.6, margin: 0 }}>{draft.context_summary}</p>
            </div>
          )}

          {billing && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subscription</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{billing.plan_name}</p>
              <p style={{ fontSize: 13, color: '#475569', marginBottom: 2 }}>{(billing.amount_cents / 100).toFixed(2)} {billing.currency} / {billing.billing_cycle}</p>
              <p style={{ fontSize: 13, color: '#475569' }}>
                Status: <strong style={{ color: billing.status === 'active' ? '#16a34a' : '#ef4444' }}>{billing.status}</strong>
              </p>
            </div>
          )}

          {recentTickets.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Tickets</p>
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
        </div>

        {/* RIGHT — varies by mode */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {isProcessed ? (
            /* ── PROCESSED MODE ─────────────────────────────── */
            <>
              {/* Follow-up banner */}
              {isFollowUp && (
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: 14, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700, color: '#92400e', margin: '0 0 2px' }}>Follow-up due</p>
                    <p style={{ fontSize: 13, color: '#78350f', margin: 0 }}>This message was snoozed and is back for your attention.</p>
                  </div>
                  <button
                    onClick={() => clearFollowUpMutation.mutate()}
                    disabled={clearFollowUpMutation.isPending}
                    style={{
                      padding: '6px 14px', background: '#d97706', color: '#fff',
                      border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      flexShrink: 0, marginLeft: 16,
                    }}
                  >
                    Mark as Handled
                  </button>
                </div>
              )}

              {/* Status banner for non-follow-up processed */}
              {!isFollowUp && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
                  background: isForwarded ? '#f5f3ff' : draft.status === 'approved' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${isForwarded ? '#ddd6fe' : draft.status === 'approved' ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius: 8, padding: 14,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
                    color: isForwarded ? '#7c3aed' : draft.status === 'approved' ? '#16a34a' : '#dc2626',
                  }}>
                    {isForwarded ? '→ Forwarded to department' : draft.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </span>
                  {draft.reviewed_at && (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      {new Date(draft.reviewed_at).toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Linked ticket */}
              {linkedTicket && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Created Ticket
                  </p>

                  {isResolved && (
                    <div style={{
                      background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6,
                      padding: '10px 14px', marginBottom: 12,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <p style={{ fontSize: 13, color: '#1e40af', margin: 0, fontWeight: 500 }}>
                        This contact has been resolved.
                      </p>
                      <button
                        onClick={() => reopenMutation.mutate()}
                        disabled={reopenMutation.isPending}
                        style={{
                          padding: '5px 12px', background: '#2563eb', color: '#fff',
                          border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          flexShrink: 0, marginLeft: 12,
                        }}
                      >
                        {reopenMutation.isPending ? 'Reopening…' : 'Reopen Ticket'}
                      </button>
                    </div>
                  )}

                  <Link to={`/tickets/${linkedTicket.id}`} style={{ textDecoration: 'none' }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 8 }}>{linkedTicket.subject}</p>
                  </Link>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Badge label={linkedTicket.status} color={STATUS_COLORS[linkedTicket.status] ?? '#64748b'} />
                    <Badge label={linkedTicket.priority} color={PRIORITY_COLORS[linkedTicket.priority] ?? '#64748b'} />
                  </div>
                </div>
              )}

              {/* AI Insights panel */}
              {draft.context_summary && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14, marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    AI Insights
                  </p>
                  <p style={{ fontSize: 13, color: '#0c4a6e', lineHeight: 1.6, margin: 0 }}>{draft.context_summary}</p>
                </div>
              )}

              {/* Navigation */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                <button onClick={() => navigate('/inbox')} style={{
                  padding: '8px 20px', background: '#f1f5f9', color: '#475569',
                  border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
                }}>
                  ← Back to Inbox
                </button>
              </div>
            </>
          ) : (
            /* ── PENDING MODE ────────────────────────────────── */
            <>
              {/* Original Message — top of right column */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Original Message
                  {msg?.source && <span style={{ marginLeft: 8, color: '#94a3b8', fontWeight: 400, textTransform: 'none' }}>via {msg.source}</span>}
                </p>
                {msg?.subject && <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>{msg.subject}</p>}
                <p style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>{msg?.raw_body}</p>
              </div>

              {/* Two-column area: Draft Reply | Draft Ticket + Workflow */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

                {/* Left: Draft Reply */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Draft Reply</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleGenerateReply}
                        disabled={replyLoading}
                        style={{
                          padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                          cursor: replyLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: replyLoading ? 0.7 : 1,
                        }}
                      >
                        {replyLoading ? 'Generating…' : 'Generate Reply'}
                      </button>
                      <button
                        onClick={handleImproveReply}
                        disabled={improveLoading || !replyText.trim()}
                        style={{
                          padding: '6px 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6,
                          cursor: (improveLoading || !replyText.trim()) ? 'not-allowed' : 'pointer',
                          fontSize: 13, fontWeight: 600, opacity: (improveLoading || !replyText.trim()) ? 0.6 : 1,
                        }}
                      >
                        {improveLoading ? 'Improving…' : 'Improve'}
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={replyText}
                    onChange={e => { setReplyText(e.target.value); setSuggestions([]) }}
                    placeholder="Click 'Generate Reply' to draft an AI reply, or write your own…"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                      fontSize: 14, resize: 'vertical', boxSizing: 'border-box', minHeight: 140, fontFamily: 'inherit',
                    }}
                  />

                  {replyText && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={handleCopy}
                          style={{
                            padding: '5px 12px',
                            background: copied ? '#f0fdf4' : '#f8fafc',
                            color: copied ? '#16a34a' : '#475569',
                            border: `1px solid ${copied ? '#bbf7d0' : '#e2e8f0'}`,
                            borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}
                        >
                          {copied ? '✓ Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={handleSendReply}
                          disabled={sending || !!sentTo}
                          style={{
                            padding: '5px 16px',
                            background: sentTo ? '#f0fdf4' : sending ? '#93c5fd' : '#2563eb',
                            color: sentTo ? '#16a34a' : '#fff',
                            border: sentTo ? '1px solid #bbf7d0' : 'none',
                            borderRadius: 5,
                            cursor: (sending || !!sentTo) ? 'not-allowed' : 'pointer',
                            fontSize: 12, fontWeight: 600,
                          }}
                        >
                          {sentTo ? '✓ Sent' : sending ? 'Sending…' : '↑ Send to Customer'}
                        </button>
                      </div>
                      {sentTo && <p style={{ fontSize: 11, color: '#16a34a', textAlign: 'right', margin: '4px 0 0' }}>Email sent to {sentTo}</p>}
                      {sendError && <p style={{ fontSize: 11, color: '#dc2626', textAlign: 'right', margin: '4px 0 0' }}>{sendError}</p>}
                    </div>
                  )}

                  {suggestions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                      {suggestions.map((s, i) => (
                        <div key={i} style={{
                          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                          padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        }}>
                          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{s.label}</span>
                          <button
                            onClick={() => { setReplyText(s.revised_text); setSuggestions([]) }}
                            style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: Draft Ticket + Suggested Workflow */}
                <div style={{ width: 300, flexShrink: 0 }}>

                  {/* Draft Ticket card */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Draft Ticket</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Subject</label>
                        <input
                          value={subject || draft.ai_suggested_subject}
                          onChange={e => setSubject(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Description</label>
                        <textarea
                          rows={4}
                          value={description || draft.ai_suggested_description}
                          onChange={e => setDescription(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Priority</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                            const active = (priority || draft.ai_suggested_priority) === p
                            return (
                              <button key={p} onClick={() => setPriority(p)} style={{
                                padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', textTransform: 'capitalize',
                                background: active ? PRIORITY_COLORS[p] : '#f1f5f9',
                                color: active ? '#fff' : '#475569',
                                border: active ? `2px solid ${PRIORITY_COLORS[p]}` : '2px solid transparent',
                              }}>
                                {p}
                              </button>
                            )
                          })}
                        </div>
                        {draft.ai_suggested_category && (
                          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>AI category: <strong>{draft.ai_suggested_category}</strong></p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                      <button
                        onClick={() => reviewMutation.mutate('approve')}
                        disabled={reviewMutation.isPending}
                        style={{ padding: '9px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13, width: '100%' }}
                      >
                        Approve & Create Ticket
                      </button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => reviewMutation.mutate('reject')}
                          disabled={reviewMutation.isPending}
                          style={{ flex: 1, padding: '8px 12px', background: '#fff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => navigate('/inbox')}
                          style={{ flex: 1, padding: '8px 12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Suggested Workflow card */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, marginTop: 12 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 14px' }}>Suggested Workflow</h2>

                    {departments && departments.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Forward to Department
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <select
                            value={selectedDeptId}
                            onChange={e => setSelectedDeptId(e.target.value)}
                            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, color: '#1e293b', background: '#fff' }}
                          >
                            <option value="">Select…</option>
                            {departments.map((d: any) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={handleForward}
                            disabled={!selectedDeptId || forwardLoading}
                            style={{
                              padding: '6px 12px', background: (!selectedDeptId || forwardLoading) ? '#c4b5fd' : '#7c3aed',
                              color: '#fff', border: 'none', borderRadius: 6,
                              cursor: (!selectedDeptId || forwardLoading) ? 'not-allowed' : 'pointer',
                              fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
                            }}
                          >
                            {forwardLoading ? '…' : 'Forward'}
                          </button>
                        </div>
                        {forwardedToName && <p style={{ fontSize: 11, color: '#16a34a', margin: 0 }}>✓ Forwarded to {forwardedToName}</p>}
                      </div>
                    )}

                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Schedule Follow-up
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#64748b' }}>In</span>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={followUpDays}
                          onChange={e => setFollowUpDays(e.target.value)}
                          placeholder="—"
                          style={{ width: 56, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, textAlign: 'center' }}
                        />
                        <span style={{ fontSize: 13, color: '#64748b' }}>days</span>
                      </div>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>Leave blank for no follow-up.</p>
                    </div>
                  </div>

                </div>
              </div>
            </>
          )}

          {/* Draft Reply in processed mode */}
          {isProcessed && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', margin: 0 }}>Draft Reply</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleGenerateReply}
                    disabled={replyLoading}
                    style={{
                      padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                      cursor: replyLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: replyLoading ? 0.7 : 1,
                    }}
                  >
                    {replyLoading ? 'Generating…' : 'Generate Reply'}
                  </button>
                  <button
                    onClick={handleImproveReply}
                    disabled={improveLoading || !replyText.trim()}
                    style={{
                      padding: '6px 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6,
                      cursor: (improveLoading || !replyText.trim()) ? 'not-allowed' : 'pointer',
                      fontSize: 13, fontWeight: 600, opacity: (improveLoading || !replyText.trim()) ? 0.6 : 1,
                    }}
                  >
                    {improveLoading ? 'Improving…' : 'Improve'}
                  </button>
                </div>
              </div>
              <textarea
                rows={6}
                value={replyText}
                onChange={e => { setReplyText(e.target.value); setSuggestions([]) }}
                placeholder="Click 'Generate Reply' to draft an AI reply, or write your own…"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                  fontSize: 14, resize: 'vertical', boxSizing: 'border-box', minHeight: 120, fontFamily: 'inherit',
                }}
              />
              {replyText && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={handleCopy} style={{ padding: '5px 12px', background: copied ? '#f0fdf4' : '#f8fafc', color: copied ? '#16a34a' : '#475569', border: `1px solid ${copied ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                    <button onClick={handleSendReply} disabled={sending || !!sentTo} style={{ padding: '5px 16px', background: sentTo ? '#f0fdf4' : sending ? '#93c5fd' : '#2563eb', color: sentTo ? '#16a34a' : '#fff', border: sentTo ? '1px solid #bbf7d0' : 'none', borderRadius: 5, cursor: (sending || !!sentTo) ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {sentTo ? '✓ Sent' : sending ? 'Sending…' : '↑ Send to Customer'}
                    </button>
                  </div>
                  {sentTo && <p style={{ fontSize: 11, color: '#16a34a', textAlign: 'right', margin: '4px 0 0' }}>Email sent to {sentTo}</p>}
                  {sendError && <p style={{ fontSize: 11, color: '#dc2626', textAlign: 'right', margin: '4px 0 0' }}>{sendError}</p>}
                </div>
              )}
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {suggestions.map((s, i) => (
                    <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{s.label}</span>
                      <button onClick={() => { setReplyText(s.revised_text); setSuggestions([]) }} style={{ padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Apply</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
