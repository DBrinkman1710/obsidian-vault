import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Paperclip, Sparkles } from 'lucide-react'
import { api } from '../../../api/client'
import { addFilesWithinLimits } from '../attachmentLimits'
import { TemplatePicker } from '../components/TemplatePicker'
import { CompanyPicker } from '../../contacts/components/CompanyPicker'
import { useTenantConfig } from '../../../App'
import { useAuth } from '../../../auth/useAuth'
import { Skeleton } from '../../../shell/Skeleton'

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', nl: 'Dutch', fr: 'French', de: 'German', es: 'Spanish',
  pt: 'Portuguese', it: 'Italian', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
  ko: 'Korean', ru: 'Russian', pl: 'Polish', tr: 'Turkish',
}

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
    phone: '', tags: '', notes: '',
  })
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [f]: e.target.value }))

  const mutation = useMutation({
    mutationFn: async () => {
      const contactRes = await api.post('/contacts', {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        company_id: companyId,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-[480px] shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Unknown Sender</h2>
        <p className="text-sm text-slate-500 mb-5">
          No contact found for <strong className="text-slate-700">{senderEmail}</strong>. Add them to continue.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full name *</label>
            <input
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
              value={form.full_name} onChange={set('full_name')} autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
              <input
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                type="email" value={form.email} onChange={set('email')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
              <input
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                value={form.phone} onChange={set('phone')} placeholder="+31 6 00000000"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Company</label>
            <CompanyPicker value={companyId} onChange={setCompanyId} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tags <span className="font-normal text-slate-400">(comma-separated)</span></label>
            <input
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
              value={form.tags} onChange={set('tags')} placeholder="vip, enterprise"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie font-sans"
              rows={3} value={form.notes} onChange={set('notes')} placeholder="Any context about this contact..."
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {mutation.isPending ? 'Saving…' : 'Create & Link Contact'}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="px-4 py-2 bg-slate-100 text-slate-600 text-sm rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RouteAndApproveModal({
  departments,
  initialDeptId,
  onApprove,
  onCancel,
}: {
  departments: any[]
  initialDeptId: string
  onApprove: (deptId: string, followUpDays?: number) => void
  onCancel: () => void
}) {
  const [deptId, setDeptId] = useState(initialDeptId)
  const [noSla, setNoSla] = useState(false)
  const [slaValue, setSlaValue] = useState('')

  const selectedDept = departments.find((d: any) => d.id === deptId)
  const autoSla: number | null = selectedDept?.sla_working_days > 0 ? selectedDept.sla_working_days : null

  // Re-init SLA input when department changes: pre-fill dept default if available
  useEffect(() => {
    setNoSla(false)
    setSlaValue(autoSla ? String(autoSla) : '')
  }, [deptId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleApprove() {
    let followUpDays: number | undefined
    if (!noSla && slaValue.trim()) followUpDays = parseInt(slaValue) || undefined
    onApprove(deptId, followUpDays)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-[440px] shadow-2xl">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-base font-bold text-slate-900">Route & Approve</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Set a department and SLA before approving, or proceed without.
        </p>

        {/* Department picker */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Department</label>
          <select
            value={deptId}
            onChange={e => setDeptId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          >
            <option value="">No department</option>
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* SLA section — always editable; pre-fills dept default when available */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Follow-up SLA</label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={noSla ? '' : slaValue}
                onChange={e => setSlaValue(e.target.value)}
                disabled={noSla}
                placeholder="Days…"
                className="w-24 text-center text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie disabled:opacity-40"
              />
              <span className="text-xs text-slate-400">working days</span>
              {autoSla && !noSla && (
                <span className="text-xs text-emerald-500">dept default: {autoSla}</span>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={noSla}
                onChange={e => { setNoSla(e.target.checked); setSlaValue('') }}
                className="rounded"
              />
              <span className="text-xs text-slate-500">No SLA / skip follow-up</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleApprove}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
        >
          Approve & Create Ticket
        </button>
      </div>
    </div>
  )
}

export default function DraftReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const config = useTenantConfig()
  const aiEnabled = config?.enabled_modules?.includes('ai') ?? true
  const { user } = useAuth()

  const { data: ctx, isLoading } = useQuery({
    queryKey: ['draft', id],
    queryFn: () => api.get(`/inbox/drafts/${id}`).then(r => r.data),
    // While the background AI enrichment is running, poll so the suggestions
    // and briefing fill in on their own.
    refetchInterval: (query) =>
      (query.state.data as any)?.draft?.ai_status === 'queued' ? 3_000 : false,
  })

  const draft = ctx?.draft
  const aiQueued = draft?.ai_status === 'queued'
  const aiFailed = draft?.ai_status === 'failed'
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
  const [showDeptReminder, setShowDeptReminder] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [improveLoading, setImproveLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ label: string; revised_text: string }>>([])
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [sendError, setSendError] = useState('')
  const [undoUntil, setUndoUntil] = useState<Date | null>(null)
  const [undoProgress, setUndoProgress] = useState(0)
  const [undoCancelled, setUndoCancelled] = useState(false)
  const [demoNotice, setDemoNotice] = useState(false)
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [usePersonalFrom, setUsePersonalFrom] = useState(false)
  const [actionError, setActionError] = useState('')

  // The router reuses this component across draft ids — reset all editable state when
  // the id changes so one draft's reply/suggestions can't leak into another.
  useEffect(() => {
    setSubject(''); setDescription(''); setPriority(''); setFollowUpDays('')
    setSelectedDeptId(''); setForwardedToName(''); setModalDismissed(false)
    // Pre-fill the user's signature (editable per email — what you see is what's sent)
    setReplyText(user?.email_signature ? `\n\n${user.email_signature}` : '')
    setSuggestions([]); setReplyFiles([])
    setSentTo(''); setSendError(''); setActionError('')
    setUndoUntil(null); setUndoProgress(0); setUndoCancelled(false)
    if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
  }, [id])

  const showContactModal = !isLoading && !!ctx && !ctx.contact && !modalDismissed && !isProcessed

  const generateMutation = useMutation({
    mutationFn: () => api.post(`/inbox/drafts/${id}/generate`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['draft', id] })
      qc.invalidateQueries({ queryKey: ['drafts'] })
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({ action, departmentId, modalFollowUpDays }: { action: 'approve' | 'reject'; departmentId?: string; modalFollowUpDays?: number }) =>
      api.post(`/inbox/drafts/${id}/review`, {
        action,
        subject: subject || draft?.ai_suggested_subject,
        description: description || draft?.ai_suggested_description,
        priority: priority || draft?.ai_suggested_priority,
        follow_up_days: modalFollowUpDays ?? (followUpDays ? parseInt(followUpDays) : undefined),
        department_id: departmentId || selectedDeptId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drafts'] })
      qc.invalidateQueries({ queryKey: ['draft', id] })
      // Stay on this page — the processed view appears once the query refetches
    },
  })

  const reopenMutation = useMutation({
    mutationFn: () => api.patch(`/tickets/${ticketId}/status`, { status: 'open' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticketId] }),
  })

  const undoReviewMutation = useMutation({
    mutationFn: () => api.post(`/inbox/drafts/${id}/undo-review`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drafts'] })
      qc.invalidateQueries({ queryKey: ['draft', id] })
      // Draft is pending again — the edit form reappears on refetch
    },
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
    setActionError('')
    try {
      const res = await api.post(`/inbox/drafts/${id}/forward`, { department_id: selectedDeptId })
      setReplyText(user?.email_signature ? `${res.data.suggestion}\n\n${user.email_signature}` : res.data.suggestion)
      setForwardedToName(res.data.department.name)
      qc.invalidateQueries({ queryKey: ['drafts'] })
      qc.invalidateQueries({ queryKey: ['draft', id] })
      setSuggestions([])
    } catch {
      setActionError('Couldn\'t forward this draft — please try again.')
    } finally {
      setForwardLoading(false)
    }
  }

  async function handleGenerateReply() {
    setReplyLoading(true)
    setActionError('')
    try {
      const res = await api.post(`/inbox/drafts/${id}/suggest-reply`)
      setReplyText(user?.email_signature ? `${res.data.suggestion}\n\n${user.email_signature}` : res.data.suggestion)
      setSuggestions([])
    } catch {
      setActionError('Couldn\'t generate a reply — please try again.')
    } finally {
      setReplyLoading(false)
    }
  }

  async function handleImproveReply() {
    if (!replyText.trim()) return
    setImproveLoading(true)
    setActionError('')
    try {
      const res = await api.post(`/inbox/drafts/${id}/improve-reply`, { current_text: replyText })
      setSuggestions(res.data.suggestions)
    } catch {
      setActionError('Couldn\'t suggest improvements — please try again.')
    } finally {
      setImproveLoading(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(replyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setActionError('Couldn\'t copy to clipboard.')
    }
  }

  async function handleSendReply() {
    if (!replyText.trim()) return
    setSending(true)
    setSendError('')
    setUndoCancelled(false)
    setDemoNotice(false)
    try {
      const form = new FormData()
      form.append('reply_text', replyText)
      replyFiles.forEach(f => form.append('attachments', f))
      if (usePersonalFrom && user?.reply_from_email) {
        form.append('from_email', user.reply_from_email)
      }
      const res = await api.post(`/inbox/drafts/${id}/send-reply`, form, {
        headers: { 'Content-Type': undefined },
      })
      if (res.data.demo) {
        setDemoNotice(true)
        return
      }
      // Count down on the local clock only — the server holds the email for
      // longer than this bar (undo_seconds < server window), so an Undo click
      // anywhere on the bar is guaranteed to arrive in time.
      const start = Date.now()
      const duration = (res.data.undo_seconds ?? 5) * 1000
      const until = new Date(start + duration)
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current)
      setUndoUntil(until)
      setUndoProgress(0)
      undoIntervalRef.current = setInterval(() => {
        const pct = Math.min(100, ((Date.now() - start) / duration) * 100)
        setUndoProgress(pct)
        if (pct >= 100) {
          clearInterval(undoIntervalRef.current!)
          undoIntervalRef.current = null
          setUndoUntil(null)
          setSentTo(res.data.to)
          setTimeout(() => setSentTo(''), 4000)
          qc.invalidateQueries({ queryKey: ['contact-activity'] })
          qc.invalidateQueries({ queryKey: ['contact-moments'] })
        }
      }, 100)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d?.msg).filter(Boolean).join(', ')
        : ''
      setSendError(message || 'Failed to send — check Resend configuration.')
    } finally {
      setSending(false)
    }
  }

  async function handleUndoSend() {
    try {
      await api.post(`/inbox/drafts/${id}/undo-send`)
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
      setUndoUntil(null)
      setUndoProgress(0)
      setUndoCancelled(true)
      setTimeout(() => setUndoCancelled(false), 3000)
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Too late — the email went out. Don't claim it was cancelled.
        if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
        setUndoUntil(null)
        setUndoProgress(0)
      }
      setSendError('Could not undo — email may already be sent.')
    }
  }

  useEffect(() => () => { if (undoIntervalRef.current) clearInterval(undoIntervalRef.current) }, [])

  if (isLoading || !draft) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-3 gap-3" aria-hidden="true">
        <div className="grid grid-cols-[320px_1fr] grid-rows-[1fr_1fr] gap-3 flex-1 min-h-0">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <Skeleton className="h-3 w-20 mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-1.5" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-5/6 mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const initials = contact?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  function handleApprove() {
    const hasDepts = departments && departments.length > 0
    if (!hasDepts) {
      reviewMutation.mutate({ action: 'approve' })
      return
    }
    // Always show the modal so the user can confirm/edit dept and SLA
    setShowDeptReminder(true)
  }

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

      {showDeptReminder && (
        <RouteAndApproveModal
          departments={departments ?? []}
          initialDeptId={selectedDeptId}
          onApprove={(deptId, fud) => {
            setShowDeptReminder(false)
            reviewMutation.mutate({ action: 'approve', departmentId: deptId || undefined, modalFollowUpDays: fud })
          }}
          onCancel={() => setShowDeptReminder(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-3 gap-3">
        <div className="grid grid-cols-[320px_1fr] grid-rows-[1fr_1fr_auto] gap-3 flex-1 min-h-0">

          {/* ── TOP-LEFT: Customer info ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Customer</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {contact ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yippie/15 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-yippie">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{contact.full_name}</p>
                      {contact.company && <p className="text-xs text-slate-500 truncate">{contact.company}</p>}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {contact.email && (
                      <p className="text-xs text-slate-600 truncate">{contact.email}</p>
                    )}
                    {contact.phone && (
                      <p className="text-xs text-slate-600">{contact.phone}</p>
                    )}
                  </div>

                  {contact.tags && contact.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((t: string) => (
                        <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[11px] rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-800 mb-2">Unknown sender — no matching contact.</p>
                  {!isProcessed && (
                    <button
                      onClick={() => setModalDismissed(false)}
                      className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-200 transition-colors cursor-pointer"
                    >
                      + Add to Contacts
                    </button>
                  )}
                </div>
              )}

              {(draft.context_summary || (aiEnabled && (aiQueued || !isProcessed))) && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <p className="text-[10px] font-bold tracking-widest text-blue-400 uppercase mb-2">AI Briefing</p>
                  {aiQueued ? (
                    <p className="text-xs text-blue-400 animate-pulse">Generating briefing…</p>
                  ) : draft.context_summary ? (
                    <p className="text-xs text-blue-900 leading-relaxed">{draft.context_summary}</p>
                  ) : (
                    <button
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-100 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-200 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles size={11} />
                      {generateMutation.isPending ? 'Generating…' : 'Generate briefing'}
                    </button>
                  )}
                </div>
              )}

              {billing && (
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Subscription</p>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">{billing.plan_name}</p>
                    <p>{(billing.amount_cents / 100).toFixed(2)} {billing.currency} / {billing.billing_cycle}</p>
                    <p>Status: <span className={billing.status === 'active' ? 'text-emerald-600 font-semibold' : 'text-red-500 font-semibold'}>{billing.status}</span></p>
                  </div>
                </div>
              )}

              {recentTickets.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Recent Tickets</p>
                  <div className="space-y-2">
                    {recentTickets.map((t: any) => (
                      <div key={t.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <p className="text-xs text-slate-800 font-medium leading-snug mb-1">{t.subject}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          <Badge label={t.status} color={STATUS_COLORS[t.status] ?? '#64748b'} />
                          <Badge label={t.priority} color={PRIORITY_COLORS[t.priority] ?? '#64748b'} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── TOP-RIGHT: Customer email ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Customer Email</span>
              <div className="flex items-center gap-2">
                {msg?.source && (
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full capitalize">
                    via {msg.source}
                  </span>
                )}
                {msg?.received_at && (
                  <span className="text-[11px] text-slate-400">
                    {new Date(msg.received_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {msg?.subject && (
                <p className="text-sm font-semibold text-slate-900 mb-3">{msg.subject}</p>
              )}
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{msg?.raw_body}</p>
              {ctx?.attachments && ctx.attachments.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Attachments</p>
                  <div className="space-y-1">
                    {ctx.attachments.map((att: { id: string; filename: string; content_type: string }) => (
                      <button
                        key={att.id}
                        onClick={async () => {
                          setActionError('')
                          try {
                            const res = await api.get(`/inbox/drafts/${id}/attachments/${att.id}/download`, { responseType: 'blob' })
                            if (!res.data || res.data.size === 0) {
                              setActionError(`${att.filename} is no longer available.`)
                              return
                            }
                            const url = URL.createObjectURL(res.data)
                            const a = document.createElement('a')
                            a.href = url; a.download = att.filename; a.click()
                            URL.revokeObjectURL(url)
                          } catch {
                            setActionError(`Couldn't download ${att.filename}.`)
                          }
                        }}
                        className="flex items-center gap-2 text-xs text-slate-600 hover:text-yippie transition-colors cursor-pointer w-full text-left"
                      >
                        <Paperclip size={12} className="shrink-0" />
                        <span className="truncate">{att.filename}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── BOTTOM-LEFT: Ticket form (pending) or Status/linked ticket (processed) ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            {isProcessed ? (
              <>
                <div className="px-4 py-3 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Review Status</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {isFollowUp ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-amber-800 text-sm">Follow-up due</p>
                        <p className="text-xs text-amber-700 mt-0.5">This message was snoozed and is back for your attention.</p>
                      </div>
                      <button
                        onClick={() => clearFollowUpMutation.mutate()}
                        disabled={clearFollowUpMutation.isPending}
                        className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Mark Handled
                      </button>
                    </div>
                  ) : (
                    <div className={`rounded-xl p-3 border text-sm font-semibold flex items-center gap-2 ${
                      isForwarded ? 'bg-violet-50 border-violet-200 text-violet-700'
                      : draft.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border-red-200 text-red-600'
                    }`}>
                      {isForwarded ? '→ Forwarded' : draft.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                      {draft.reviewed_at && (
                        <span className="text-xs font-normal text-slate-400 ml-1">
                          {new Date(draft.reviewed_at).toLocaleString()}
                        </span>
                      )}
                      {!isForwarded && (
                        <button
                          onClick={() => undoReviewMutation.mutate()}
                          disabled={undoReviewMutation.isPending}
                          title={draft.status === 'approved' ? 'Back to pending — the created ticket is removed' : 'Back to pending'}
                          className="ml-auto shrink-0 text-xs font-semibold px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {undoReviewMutation.isPending ? 'Undoing…' : 'Undo'}
                        </button>
                      )}
                    </div>
                  )}

                  {linkedTicket && (
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Created Ticket</p>
                      {isResolved && (
                        <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs text-blue-800 font-medium">This ticket has been resolved.</p>
                          <button
                            onClick={() => reopenMutation.mutate()}
                            disabled={reopenMutation.isPending}
                            className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                            {reopenMutation.isPending ? 'Reopening…' : 'Reopen'}
                          </button>
                        </div>
                      )}
                      <Link to={`/tickets/${linkedTicket.id}`} className="no-underline block mb-2">
                        <p className="text-sm font-semibold text-slate-800 hover:text-yippie transition-colors">{linkedTicket.subject}</p>
                      </Link>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge label={linkedTicket.status} color={STATUS_COLORS[linkedTicket.status] ?? '#64748b'} />
                        <Badge label={linkedTicket.priority} color={PRIORITY_COLORS[linkedTicket.priority] ?? '#64748b'} />
                      </div>
                    </div>
                  )}

                  {draft.context_summary && !draft.approved_ticket_id && (
                    <div className="rounded-xl bg-sky-50 border border-sky-100 p-3">
                      <p className="text-[10px] font-bold tracking-widest text-sky-400 uppercase mb-2">AI Insights</p>
                      <p className="text-xs text-sky-900 leading-relaxed">{draft.context_summary}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-slate-100 shrink-0">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Draft Ticket</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {aiEnabled && (aiQueued || aiFailed) && (
                    <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 flex items-center justify-between gap-2 flex-wrap">
                      {aiQueued ? (
                        <p className="text-xs text-violet-600 animate-pulse">AI is analyzing this email — suggestions will fill in automatically.</p>
                      ) : (
                        <p className="text-xs text-violet-600">AI analysis failed — the raw email is shown instead.</p>
                      )}
                      <button
                        onClick={() => generateMutation.mutate()}
                        disabled={generateMutation.isPending}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-100 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-200 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles size={11} />
                        {generateMutation.isPending ? 'Generating…' : 'Generate now'}
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Subject</label>
                    <input
                      value={subject || draft.ai_suggested_subject || ''}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Description</label>
                    <textarea
                      rows={5}
                      value={description || draft.ai_suggested_description || ''}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie transition-colors font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Priority</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                        const active = (priority || draft.ai_suggested_priority) === p
                        return (
                          <button
                            key={p}
                            onClick={() => setPriority(p)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all ${
                              active ? 'text-white shadow-sm scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            style={active ? { background: PRIORITY_COLORS[p] } : {}}
                          >
                            {p}
                          </button>
                        )
                      })}
                    </div>
                    {draft.ai_suggested_category && (
                      <p className="text-[11px] text-slate-400 mt-2">
                        AI category: <strong className="text-slate-500">{draft.ai_suggested_category}</strong>
                      </p>
                    )}
                  </div>
                </div>
                <div className="p-3 border-t border-slate-100 shrink-0 space-y-2">
                  <button
                    onClick={handleApprove}
                    disabled={reviewMutation.isPending}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {reviewMutation.isPending ? 'Creating…' : 'Approve & Create Ticket'}
                  </button>
                  <button
                    onClick={() => reviewMutation.mutate({ action: 'reject' })}
                    disabled={reviewMutation.isPending}
                    className="w-full py-2 text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── BOTTOM-RIGHT: Draft reply ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Draft Reply</span>
                {draft.detected_language && draft.detected_language !== 'en' && (
                  <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full font-medium">
                    Reply in {LANGUAGE_NAMES[draft.detected_language] ?? draft.detected_language}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {aiEnabled && (
                  <>
                    <button
                      onClick={handleGenerateReply}
                      disabled={replyLoading}
                      className="px-3 py-1.5 bg-yippie text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                    >
                      {replyLoading ? 'Generating…' : 'Generate'}
                    </button>
                    <button
                      onClick={handleImproveReply}
                      disabled={improveLoading || !replyText.trim()}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      {improveLoading ? 'Improving…' : 'Improve'}
                    </button>
                  </>
                )}
                <TemplatePicker
                  context={msg ? `${msg.subject ?? ''}\n\n${msg.raw_body ?? ''}` : ''}
                  onSelect={body => setReplyText(prev =>
                    prev.trim() ? `${body}\n\n${prev}` : body
                  )}
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col p-3 gap-2 min-h-0">
              <textarea
                value={replyText}
                onChange={e => { setReplyText(e.target.value); setSuggestions([]) }}
                onKeyDown={e => {
                  if (user?.hotkeys_enabled === false) return
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !sending && !undoUntil && !sentTo && replyText.trim()) {
                    e.preventDefault()
                    handleSendReply()
                  }
                }}
                placeholder="Click 'Generate' to draft an AI reply, or write your own…"
                className="flex-1 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie focus:bg-white transition-colors font-sans placeholder:text-slate-400 min-h-0"
              />

              {suggestions.length > 0 && (
                <div className="space-y-1.5 max-h-28 overflow-y-auto shrink-0">
                  {suggestions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs text-slate-600 font-medium">{s.label}</span>
                      <button
                        onClick={() => { setReplyText(s.revised_text); setSuggestions([]) }}
                        className="shrink-0 text-xs font-semibold px-2.5 py-1 bg-yippie text-white rounded-lg hover:opacity-90 cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Attached files */}
              {replyFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {replyFiles.map((f, i) => (
                    <div key={`${f.name}-${f.size}-${f.lastModified}`} className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-xs text-slate-600">
                      <Paperclip size={10} />
                      <span className="max-w-[120px] truncate">{f.name}</span>
                      <button onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-3 py-2.5 border-t border-slate-100 shrink-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Attach files */}
                <label className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
                  <Paperclip size={13} />
                  <span>Attach</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => {
                      if (e.target.files) {
                        const { files, error } = addFilesWithinLimits(replyFiles, Array.from(e.target.files))
                        setReplyFiles(files)
                        setSendError(error)
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
                {/* From selector — only shown when user has a personal reply address */}
                {user?.reply_from_email && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <span className="text-slate-400">From:</span>
                    <button
                      type="button"
                      onClick={() => setUsePersonalFrom(false)}
                      className={`px-2 py-0.5 rounded-md transition-colors ${!usePersonalFrom ? 'bg-yippie/10 text-yippie font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      Shared
                    </button>
                    <button
                      type="button"
                      onClick={() => setUsePersonalFrom(true)}
                      className={`px-2 py-0.5 rounded-md transition-colors ${usePersonalFrom ? 'bg-yippie/10 text-yippie font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      {user.reply_from_email}
                    </button>
                  </div>
                )}
                <div className="text-xs">
                  {undoCancelled && <span className="text-slate-400">Send cancelled</span>}
                  {demoNotice && <span className="text-amber-600">Demo mode — email not sent</span>}
                  {sentTo && !undoCancelled && <span className="text-emerald-600">Sent to {sentTo}</span>}
                  {sendError && <span className="text-red-500">{sendError}</span>}
                  {actionError && !sendError && <span className="text-red-500">{actionError}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {replyText && (
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      copied
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                )}
                <button
                  onClick={handleSendReply}
                  disabled={sending || !!undoUntil || !!sentTo || !replyText.trim()}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    sentTo
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : undoUntil
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-yippie text-white hover:opacity-90 disabled:opacity-40'
                  }`}
                >
                  {sentTo ? '✓ Sent' : sending ? 'Sending…' : undoUntil ? 'Queued…' : 'Send to Customer'}
                </button>
              </div>
            </div>
          </div>

          {/* ── ROUTING STRIP (pending mode only) ── */}
          {!isProcessed && (
            <div className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-4">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase shrink-0">Route</span>

              {departments && departments.length > 0 && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDeptId}
                    onChange={e => setSelectedDeptId(e.target.value)}
                    className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                  >
                    <option value="">Select department…</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleForward}
                    disabled={!selectedDeptId || forwardLoading}
                    className="px-3 py-1.5 text-xs font-semibold bg-violet-500 text-white rounded-xl hover:bg-violet-600 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {forwardLoading ? '…' : 'Forward'}
                  </button>
                  {forwardedToName && (
                    <span className="text-xs text-emerald-600 font-medium">✓ Forwarded to {forwardedToName}</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-slate-500">Follow-up in</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={followUpDays}
                  onChange={e => setFollowUpDays(e.target.value)}
                  placeholder="—"
                  className="w-14 text-center text-sm border border-slate-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                />
                <span className="text-xs text-slate-500">days</span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Undo send floating bar */}
      {undoUntil && (
        <div className="fixed bottom-5 right-5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-slate-900 text-sm">Yippie</p>
              <p className="text-xs text-slate-400">email sent</p>
            </div>
            <button
              onClick={handleUndoSend}
              className="px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
            >
              Undo
            </button>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-yippie rounded-full"
              style={{ width: `${undoProgress}%`, transition: 'width 0.1s linear' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
