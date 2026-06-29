import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Paperclip, Sparkles, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { addFilesWithinLimits } from '../attachmentLimits'
import { TemplatePicker, htmlToText } from '../components/TemplatePicker'
import { CompanyPicker } from '../../contacts/components/CompanyPicker'
import { useTenantConfig } from '../../../App'
import { useAuth } from '../../../auth/useAuth'
import { Skeleton } from '../../../shell/Skeleton'
import { useMobile } from '../../../shell/useMobile'
import { useSignatures, pickDefaultSignature, swapSignature, type Signature } from '../../../hooks/useSignatures'
import { SignaturePicker } from '../components/SignaturePicker'

interface PipelineStage { id: string; name: string; color: string }

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

function useSplitPane(storageKey: string, defaultPct = 50) {
  const [pct, setPct] = useState<number>(() => {
    try { const v = localStorage.getItem(storageKey); return v ? parseFloat(v) : defaultPct } catch { return defaultPct }
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const pctRef = useRef(pct)

  const startDrag = useCallback((e: React.MouseEvent, snapTo?: number) => {
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const raw = Math.min(Math.max(((ev.clientY - rect.top) / rect.height) * 100, 20), 80)
      const clamped = snapTo !== undefined && Math.abs(raw - snapTo) < 2 ? snapTo : raw
      pctRef.current = clamped
      setPct(clamped)
    }
    const onUp = () => {
      try { localStorage.setItem(storageKey, String(pctRef.current)) } catch {}
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [storageKey])

  return { pct, containerRef, startDrag }
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
    phone: '', notes: '',
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-[480px] shadow-2xl max-h-[90vh] overflow-y-auto">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-[440px] shadow-2xl">
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
  const [searchParams] = useSearchParams()
  const mailbox = searchParams.get('mailbox') ?? 'shared'
  const navigate = useNavigate()
  const qc = useQueryClient()
  const config = useTenantConfig()
  const aiEnabled = config?.enabled_modules?.includes('ai') ?? true
  const isPipelineEnabled = config?.enabled_modules?.includes('pipeline') ?? false
  const marketingEnabled = config?.enabled_modules?.includes('marketing') ?? true
  const { user } = useAuth()
  const { data: signatures } = useSignatures()
  const defaultSig = pickDefaultSignature(signatures)
  const [appliedSig, setAppliedSig] = useState<string | null>(null)
  const isMobile = useMobile()
  const { pct: emailPct, containerRef: splitRef, startDrag: startSplitDrag } = useSplitPane('inbox_email_split', 50)
  const { pct: customerPct, containerRef: leftSplitRef, startDrag: startLeftSplitDrag } = useSplitPane('inbox_left_split', 50)
  const [emailExpanded, setEmailExpanded] = useState(false)

  const { data: ctx, isLoading, isError } = useQuery({
    queryKey: ['draft', id],
    queryFn: () => api.get(`/inbox/drafts/${id}`).then((r: any) => r.data),
    // While the background AI enrichment is running, poll so the suggestions
    // and briefing fill in on their own.
    refetchInterval: (query: any) =>
      (query.state.data as any)?.draft?.ai_status === 'queued' ? 3_000 : false,
    retry: 1,
  })

  const draft = ctx?.draft
  const aiQueued = draft?.ai_status === 'queued'
  const aiFailed = draft?.ai_status === 'failed'
  // scan: detected_language is null until scan_message has run
  const scanNotRun = !draft?.detected_language
  // briefing: context_summary is null until generate_context_summary has run
  const briefingNotRun = !draft?.context_summary
  const msg = ctx?.inbound_message
  const contact = ctx?.contact
  const recentTickets: any[] = ctx?.recent_tickets ?? []
  const billing = ctx?.billing

  const ticketId = draft?.approved_ticket_id
  const { data: linkedTicket } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.get(`/tickets/${ticketId}`).then((r: any) => r.data),
    enabled: !!ticketId,
  })

  const isProcessed = draft?.status !== 'pending'
  const isFollowUp = draft?.status === 'approved' && !!draft?.follow_up_at
  const isForwarded = draft?.status === 'forwarded'
  const isResolved = linkedTicket?.status === 'closed' || linkedTicket?.status === 'resolved'

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r: any) => r.data),
    enabled: !isProcessed,
  })

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
    enabled: isPipelineEnabled && !isProcessed,
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
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [ccInput, setCcInput] = useState('')
  const [bccInput, setBccInput] = useState('')
  const [undoUntil, setUndoUntil] = useState<Date | null>(null)
  const [undoProgress, setUndoProgress] = useState(0)
  const [undoCancelled, setUndoCancelled] = useState(false)
  const [demoNotice, setDemoNotice] = useState(false)
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [fromEmail, setFromEmail] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionTab, setActionTab] = useState<'ticket' | 'pipeline'>('ticket')
  const [selectedPipelineStageId, setSelectedPipelineStageId] = useState('')

  // The router reuses this component across draft ids — reset all editable state when
  // the id changes so one draft's reply/suggestions can't leak into another.
  useEffect(() => {
    setSubject(''); setDescription(''); setPriority(''); setFollowUpDays('')
    setSelectedDeptId(''); setForwardedToName(''); setModalDismissed(false)
    // Pre-fill the user's default signature (editable per email — what you see is what's sent)
    setReplyText(defaultSig ? `\n\n${defaultSig.body}` : '')
    setAppliedSig(defaultSig?.body ?? null)
    setSuggestions([]); setReplyFiles([])
    setSentTo(''); setSendError(''); setActionError('')
    setShowCcBcc(false); setCcInput(''); setBccInput('')
    setActionTab('ticket'); setSelectedPipelineStageId('')
    setUndoUntil(null); setUndoProgress(0); setUndoCancelled(false)
    setFromEmail(mailbox === 'personal' ? (user?.reply_from_email ?? null) : null)
    if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
  }, [id, defaultSig?.body, mailbox, user?.reply_from_email])

  const showContactModal = !isLoading && !!ctx && !ctx.contact && !modalDismissed && !isProcessed

  const generateScanMutation = useMutation({
    mutationFn: () => api.post(`/inbox/drafts/${id}/generate?mode=scan`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['draft', id] })
      qc.invalidateQueries({ queryKey: ['drafts'] })
      toast.success('AI suggestions generated.')
    },
    onError: () => toast.error('AI generation failed — please try again.'),
  })

  const generateBriefingMutation = useMutation({
    mutationFn: () => api.post(`/inbox/drafts/${id}/generate?mode=briefing`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['draft', id] })
      qc.invalidateQueries({ queryKey: ['drafts'] })
      toast.success('Customer briefing generated.')
    },
    onError: () => toast.error('AI generation failed — please try again.'),
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
    onMutate: async ({ action }: any) => {
      await qc.cancelQueries({ queryKey: ['draft', id] })
      const prev = qc.getQueryData(['draft', id])
      // Optimistically flip the single draft's status so the processed view shows immediately
      qc.setQueryData(['draft', id], (old: any) =>
        old?.draft ? { ...old, draft: { ...old.draft, status: action === 'approve' ? 'approved' : 'rejected' } } : old)
      return { prev }
    },
    onError: (_err: any, _body: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['draft', id], ctx.prev)
      toast.error('Action failed. Please try again.')
    },
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
    mutationFn: () => api.post(`/inbox/drafts/${id}/undo-review`).then((r: any) => r.data),
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

  const moveStageMutation = useMutation({
    mutationFn: (stageId: string) => api.put(`/pipeline/contacts/${contact?.id}/stage`, { stage_id: stageId }),
    onSuccess: () => {
      toast.success('Contact moved to pipeline stage.')
      qc.invalidateQueries({ queryKey: ['contact-pipeline-stage', contact?.id] })
      qc.invalidateQueries({ queryKey: ['pipeline-board'] })
    },
    onError: () => toast.error('Failed to move contact to stage.'),
  })

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'r') replyTextareaRef.current?.focus()
      if (e.key === 'e' && !isProcessed && !reviewMutation.isPending && !replyText.trim()) {
        reviewMutation.mutate({ action: 'approve' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isProcessed, reviewMutation, replyText])

  function pickSignature(sig: Signature) {
    setReplyText(prev => swapSignature(prev, appliedSig, sig.body))
    setAppliedSig(sig.body)
    setSuggestions([])
  }

  async function handleForward() {
    if (!selectedDeptId) return
    setForwardLoading(true)
    setActionError('')
    try {
      const res = await api.post(`/inbox/drafts/${id}/forward`, { department_id: selectedDeptId })
      setReplyText(appliedSig ? `${res.data.suggestion}\n\n${appliedSig}` : res.data.suggestion)
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
      setReplyText(appliedSig ? `${res.data.suggestion}\n\n${appliedSig}` : res.data.suggestion)
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
      if (fromEmail) {
        form.append('from_email', fromEmail)
      }
      if (ccInput.trim()) form.append('cc', ccInput.trim())
      if (bccInput.trim()) form.append('bcc', bccInput.trim())
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

  if (isError) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center bg-slate-50 gap-3 p-8 text-center">
        <p className="text-slate-500 font-medium">Couldn't load this email.</p>
        <button onClick={() => navigate('/inbox')} className="text-sm text-blue-600 underline underline-offset-2">
          Back to Inbox
        </button>
      </div>
    )
  }

  if (isLoading || !draft) {
    if (isMobile) {
      return (
        <div className="flex flex-col flex-1 overflow-auto bg-slate-50 p-4 gap-3" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <Skeleton className="h-3 w-20 mb-4" />
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-slate-50 p-3 gap-3" aria-hidden="true">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 flex-1 min-h-0">
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

  // ── Mobile view ────────────────────────────────────────────────────────────
  if (isMobile) {
    const bodyPreview = msg?.raw_body?.slice(0, 200) ?? ''
    const bodyFull = msg?.raw_body ?? ''
    const bodyIsLong = bodyFull.length > 200

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

        <div className="flex flex-col flex-1 overflow-auto bg-slate-50 pb-32">
          {/* Back */}
          <div className="px-4 pt-4 pb-2">
            <Link to="/inbox" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
              <ArrowLeft size={15} />
              Inbox
            </Link>
          </div>

          <div className="px-4 flex flex-col gap-3">
            {/* Status banner (processed) */}
            {isProcessed && (
              <div className={`rounded-2xl p-4 border text-sm font-semibold flex items-center gap-2 ${
                isForwarded ? 'bg-violet-50 border-violet-200 text-violet-700'
                : draft.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-red-50 border-red-200 text-red-600'
              }`}>
                {isForwarded ? '→ Forwarded' : draft.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                {!isForwarded && (
                  <button
                    onClick={() => undoReviewMutation.mutate()}
                    disabled={undoReviewMutation.isPending}
                    className="ml-auto shrink-0 text-xs font-semibold px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    {undoReviewMutation.isPending ? 'Undoing…' : 'Undo'}
                  </button>
                )}
              </div>
            )}

            {linkedTicket && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-2">Created Ticket</p>
                <Link to={`/tickets/${linkedTicket.id}`} className="text-sm font-semibold text-slate-800 hover:text-yippie transition-colors block mb-2">
                  {linkedTicket.subject}
                </Link>
                <div className="flex gap-1.5 flex-wrap">
                  <Badge label={linkedTicket.status} color={STATUS_COLORS[linkedTicket.status] ?? '#64748b'} />
                  <Badge label={linkedTicket.priority} color={PRIORITY_COLORS[linkedTicket.priority] ?? '#64748b'} />
                </div>
              </div>
            )}

            {/* Customer */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Customer</p>
                {aiEnabled && generateBriefingMutation.isPending && <span className="text-[10px] text-blue-400 animate-pulse">Generating…</span>}
                {aiEnabled && (briefingNotRun || aiFailed) && !isProcessed && !generateBriefingMutation.isPending && (
                  <button onClick={() => generateBriefingMutation.mutate()} disabled={generateBriefingMutation.isPending} className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50 cursor-pointer">
                    <Sparkles size={9} />
                    {aiFailed ? 'Retry' : 'Generate'}
                  </button>
                )}
              </div>
              {contact ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yippie/15 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-yippie">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{contact.full_name}</p>
                    {contact.company && <p className="text-xs text-slate-500 truncate">{contact.company}</p>}
                    {contact.email && <p className="text-xs text-slate-500 truncate">{contact.email}</p>}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-800 mb-2">Unknown sender — no matching contact.</p>
                  {!isProcessed && (
                    <button
                      onClick={() => setModalDismissed(false)}
                      className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-200 transition-colors"
                    >
                      + Add to Contacts
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Email body */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Email</p>
                {msg?.received_at && (
                  <span className="text-[11px] text-slate-400">{new Date(msg.received_at).toLocaleString()}</span>
                )}
              </div>
              {msg?.subject && <p className="text-sm font-semibold text-slate-900 mb-2">{msg.subject}</p>}
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {emailExpanded || !bodyIsLong ? bodyFull : bodyPreview + '…'}
              </p>
              {bodyIsLong && (
                <button
                  onClick={() => setEmailExpanded(v => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80 transition-opacity"
                >
                  {emailExpanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Show full email</>}
                </button>
              )}
            </div>

            {/* AI briefing */}
            {draft.context_summary && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-[10px] font-bold tracking-widest text-blue-400 uppercase mb-2">AI Briefing</p>
                <p className="text-xs text-blue-900 leading-relaxed">{draft.context_summary}</p>
              </div>
            )}
            {aiEnabled && aiQueued && !draft.context_summary && (
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs text-blue-400 animate-pulse">AI is analyzing this email…</p>
              </div>
            )}
            {/* Actions box — pending only */}
            {!isProcessed && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Actions</p>
                  {actionTab === 'ticket' && aiEnabled && generateScanMutation.isPending && <span className="text-[10px] text-violet-400 animate-pulse">Generating…</span>}
                  {actionTab === 'ticket' && aiEnabled && (scanNotRun || aiFailed) && !generateScanMutation.isPending && (
                    <button onClick={() => generateScanMutation.mutate()} disabled={generateScanMutation.isPending} className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50 cursor-pointer">
                      <Sparkles size={9} />
                      {aiFailed ? 'Retry' : 'Generate'}
                    </button>
                  )}
                </div>

                {isPipelineEnabled && (
                  <div className="flex border-b border-slate-100">
                    {(['ticket', 'pipeline'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setActionTab(t)}
                        className={`flex-1 py-2 text-[11px] font-semibold capitalize transition-colors ${
                          actionTab === t
                            ? 'text-slate-800 border-b-2 border-slate-700 -mb-px bg-white'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                <div className="p-4 space-y-4">
                  {actionTab === 'ticket' ? (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1.5">Subject</label>
                        <input
                          value={subject || draft.ai_suggested_subject || ''}
                          onChange={e => setSubject(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-2">Priority</label>
                        <div className="flex gap-2 flex-wrap">
                          {(['low', 'medium', 'high', 'urgent'] as const).map(p => {
                            const active = (priority || draft.ai_suggested_priority) === p
                            return (
                              <button
                                key={p}
                                onClick={() => setPriority(p)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${
                                  active ? 'text-white shadow-sm scale-105' : 'bg-slate-100 text-slate-500'
                                }`}
                                style={active ? { background: PRIORITY_COLORS[p] } : {}}
                              >
                                {p}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    !contact ? (
                      <p className="text-xs text-slate-400">Link a contact first to move them to a pipeline stage.</p>
                    ) : stages.length === 0 ? (
                      <p className="text-xs text-slate-400">No pipeline stages configured yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {stages.map((s: any) => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedPipelineStageId(s.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                              selectedPipelineStageId === s.id
                                ? 'border-slate-700 bg-slate-50 text-slate-900 shadow-sm'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                            {s.name}
                          </button>
                        ))}
                        <button
                          onClick={() => selectedPipelineStageId && moveStageMutation.mutate(selectedPipelineStageId)}
                          disabled={!selectedPipelineStageId || moveStageMutation.isPending}
                          className="w-full py-2.5 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50 cursor-pointer mt-2"
                        >
                          {moveStageMutation.isPending ? 'Moving…' : 'Move to Stage'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky action bar */}
        {!isProcessed && (
          <div className="fixed bottom-16 inset-x-0 p-4 bg-white border-t border-slate-100 flex gap-3 z-30">
            <button
              onClick={() => reviewMutation.mutate({ action: 'reject' })}
              disabled={reviewMutation.isPending}
              className="flex-1 py-3 text-sm font-semibold text-red-500 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={reviewMutation.isPending}
              className="inline-flex items-center justify-center flex-[2] py-3 text-sm font-bold text-white bg-emerald-500 rounded-2xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewMutation.isPending ? 'Creating…' : 'Approve & Create Ticket'}
              {reviewMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />}
            </button>
          </div>
        )}
      </>
    )
  }
  // ── End mobile view ────────────────────────────────────────────────────────

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
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 flex-1 min-h-0">

          {/* ── LEFT COLUMN ── */}
          <div ref={leftSplitRef} className="flex flex-col min-h-0">

          {/* ── TOP-LEFT: Customer info ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0" style={{ flex: customerPct }}>
            <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Customer</span>
              {aiEnabled && generateBriefingMutation.isPending && <span className="text-[10px] text-blue-400 animate-pulse">Generating…</span>}
              {aiEnabled && (briefingNotRun || aiFailed) && !isProcessed && !generateBriefingMutation.isPending && (
                <button onClick={() => generateBriefingMutation.mutate()} disabled={generateBriefingMutation.isPending} className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50 cursor-pointer">
                  <Sparkles size={9} />
                  {aiFailed ? 'Retry' : 'Generate'}
                </button>
              )}
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

              {(draft.context_summary || (aiEnabled && aiQueued)) && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
                  <p className="text-[10px] font-bold tracking-widest text-blue-400 uppercase mb-2">AI Briefing</p>
                  {aiQueued ? (
                    <p className="text-xs text-blue-400 animate-pulse">Generating briefing…</p>
                  ) : (
                    <p className="text-xs text-blue-900 leading-relaxed">{draft.context_summary}</p>
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

          {/* ── LEFT SPLIT HANDLE ── */}
          <div
            onMouseDown={e => startLeftSplitDrag(e, emailPct)}
            className="h-2 shrink-0 flex items-center justify-center cursor-row-resize group my-0.5"
            title="Drag to resize"
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 group-hover:bg-yippie/50 transition-colors" />
          </div>

          {/* ── BOTTOM-LEFT: Ticket form (pending) or Status/linked ticket (processed) ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0" style={{ flex: 100 - customerPct }}>
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
                            className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-yippie text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
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
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100 shrink-0 flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Actions</span>
                  {actionTab === 'ticket' && aiEnabled && generateScanMutation.isPending && <span className="text-[10px] text-violet-400 animate-pulse">Generating…</span>}
                  {actionTab === 'ticket' && aiEnabled && (scanNotRun || aiFailed) && !isProcessed && !generateScanMutation.isPending && (
                    <button onClick={() => generateScanMutation.mutate()} disabled={generateScanMutation.isPending} className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50 cursor-pointer">
                      <Sparkles size={9} />
                      {aiFailed ? 'Retry' : 'Generate'}
                    </button>
                  )}
                </div>

                {/* Tabs — only when pipeline module is active */}
                {isPipelineEnabled && (
                  <div className="flex shrink-0 border-b border-slate-100">
                    {(['ticket', 'pipeline'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setActionTab(t)}
                        className={`flex-1 py-2 text-[11px] font-semibold capitalize transition-colors ${
                          actionTab === t
                            ? 'text-slate-800 border-b-2 border-slate-700 -mb-px bg-white'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tab: Ticket */}
                {actionTab === 'ticket' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
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

                {/* Tab: Pipeline */}
                {actionTab === 'pipeline' && (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {!contact ? (
                        <p className="text-xs text-slate-400">Link a contact first to move them to a pipeline stage.</p>
                      ) : stages.length === 0 ? (
                        <p className="text-xs text-slate-400">No pipeline stages configured yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {stages.map((s: any) => (
                            <button
                              key={s.id}
                              onClick={() => setSelectedPipelineStageId(s.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                                selectedPipelineStageId === s.id
                                  ? 'border-slate-700 bg-slate-50 text-slate-900 shadow-sm'
                                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                              {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-slate-100 shrink-0">
                      <button
                        onClick={() => selectedPipelineStageId && moveStageMutation.mutate(selectedPipelineStageId)}
                        disabled={!selectedPipelineStageId || !contact || moveStageMutation.isPending}
                        className="w-full py-2.5 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity disabled:opacity-50 cursor-pointer"
                      >
                        {moveStageMutation.isPending ? 'Moving…' : 'Move to Stage'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          </div>{/* end LEFT COLUMN */}

          {/* ── RIGHT COLUMN with resizable split ── */}
          <div ref={splitRef} className="flex flex-col min-h-0">

          {/* ── TOP-RIGHT: Customer email ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0" style={{ flex: emailPct }}>
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

          {/* ── SPLIT HANDLE ── */}
          <div
            onMouseDown={e => startSplitDrag(e, customerPct)}
            className="h-2 shrink-0 flex items-center justify-center cursor-row-resize group my-0.5"
            title="Drag to resize"
          >
            <div className="w-10 h-1 rounded-full bg-slate-200 group-hover:bg-yippie/50 transition-colors" />
          </div>

          {/* ── BOTTOM-RIGHT: Draft reply ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden min-h-0" style={{ flex: 100 - emailPct }}>
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
                <SignaturePicker onPick={pickSignature} />
                {marketingEnabled && (
                  <TemplatePicker
                    context={msg ? `${msg.subject ?? ''}\n\n${msg.raw_body ?? ''}` : ''}
                    onSelect={(body, isHtml) => {
                      const text = isHtml ? htmlToText(body) : body
                      setReplyText(prev => prev.trim() ? `${text}\n\n${prev}` : text)
                    }}
                  />
                )}
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col p-3 gap-2 min-h-0">
              {aiEnabled && replyText.replace(/\s+/g, '') === (appliedSig ?? '').replace(/\s+/g, '') && (
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                  <Sparkles size={13} className="text-blue-400 shrink-0" />
                  <p className="text-xs text-blue-700">
                    Click <strong>Generate</strong> above to draft an AI reply, or write below.
                  </p>
                </div>
              )}
              {showCcBcc && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 w-8 shrink-0">CC</span>
                    <input
                      className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-yippie/30 focus:border-yippie"
                      value={ccInput} onChange={e => setCcInput(e.target.value)}
                      placeholder="cc@example.com, another@example.com"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 w-8 shrink-0">BCC</span>
                    <input
                      className="flex-1 px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-yippie/30 focus:border-yippie"
                      value={bccInput} onChange={e => setBccInput(e.target.value)}
                      placeholder="bcc@example.com"
                    />
                  </div>
                </div>
              )}
              <textarea
                ref={replyTextareaRef}
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
                {/* CC/BCC toggle */}
                <button
                  type="button"
                  onClick={() => setShowCcBcc(v => !v)}
                  className={`text-xs font-medium transition-colors ${showCcBcc ? 'text-yippie' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  CC / BCC
                </button>
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
                {/* From selector — only shown when user has a personal reply address or aliases */}
                {(user?.reply_from_email || (user?.send_from_aliases ?? []).length > 0) && (
                  <div className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
                    <span className="text-slate-400">From:</span>
                    <button
                      type="button"
                      onClick={() => setFromEmail(null)}
                      className={`px-2 py-0.5 rounded-md transition-colors ${fromEmail === null ? 'bg-yippie/10 text-yippie font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}
                    >
                      Shared
                    </button>
                    {user?.reply_from_email && (
                      <button
                        type="button"
                        onClick={() => setFromEmail(user.reply_from_email!)}
                        className={`px-2 py-0.5 rounded-md transition-colors ${fromEmail === user.reply_from_email ? 'bg-yippie/10 text-yippie font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}
                      >
                        {user.reply_from_email}
                      </button>
                    )}
                    {(user?.send_from_aliases ?? []).map((alias: any) => (
                      <button
                        key={alias}
                        type="button"
                        onClick={() => setFromEmail(alias)}
                        className={`px-2 py-0.5 rounded-md transition-colors ${fromEmail === alias ? 'bg-yippie/10 text-yippie font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}
                      >
                        {alias}
                      </button>
                    ))}
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
                  className={`inline-flex items-center gap-1 px-4 py-1.5 text-xs font-semibold rounded-lg transition-opacity cursor-pointer disabled:cursor-not-allowed ${
                    sentTo
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : undoUntil
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-yippie text-white hover:opacity-90 disabled:opacity-40'
                  }`}
                >
                  {sentTo ? '✓ Sent' : sending ? 'Sending…' : undoUntil ? 'Queued…' : 'Send to Customer'}
                  {sending && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />}
                </button>
              </div>
            </div>
          </div>
          </div>{/* end RIGHT COLUMN */}

          {/* ── ROUTING STRIP (pending mode only) ── */}
          {!isProcessed && (
            <div className="col-span-1 md:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-4 flex-wrap">
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
