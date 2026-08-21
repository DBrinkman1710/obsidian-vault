import { useState, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Lock, Trash2, X, CalendarClock, GitMerge, Sparkles, UserPlus, Mail, ExternalLink, ChevronRight, Paperclip, MessageSquare, Check, AlertTriangle } from 'lucide-react'
import { SignaturePicker } from '../../inbox/components/SignaturePicker'
import { TemplatePicker, htmlToText } from '../../inbox/components/TemplatePicker'
import { useSignatures, pickDefaultSignature, swapSignature } from '../../../hooks/useSignatures'
import type { Signature } from '../../../hooks/useSignatures'
import { MutationGate } from '../../../shell/MutationGate'
import { CloseButton } from '../../../shell/CloseButton'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'
import { useT } from '../../../hooks/useT'
import SendBookingModal from '../../booking/components/SendBookingModal'
import { timeAgo } from '../../../lib/format'

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']

const PRIORITY_TEXT: Record<string, string> = {
  low:    'text-slate-600',
  medium: 'text-blue-600',
  high:   'text-amber-600',
  urgent: 'text-red-600',
}

const YIPPIE_BLUE = '#5BA4F5'

type MergeCandidate = {
  id: string
  subject: string
  status: string
  created_at: string
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const tl = useT()
  const STATUS_LABELS: Record<string, string> = {
    open:        tl('status_open'),
    in_progress: tl('status_in_progress'),
    waiting:     tl('status_waiting'),
    resolved:    tl('status_resolved'),
    closed:      tl('status_closed'),
  }
  const PRIORITY_LABELS: Record<string, string> = {
    low:    tl('priority_low'),
    medium: tl('priority_medium'),
    high:   tl('priority_high'),
    urgent: tl('priority_urgent'),
  }
  const config = useTenantConfig()
  const bookingEnabled = config?.enabled_modules?.includes('booking') ?? false
  const canDelete = user?.role === 'admin' || user?.role === 'superadmin'
  const [comment, setComment] = useState('')
  const [activeTab, setActiveTab] = useState<'reply' | 'internal'>('reply')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Inline email compose state
  const { data: signatures } = useSignatures()
  const defaultSig = pickDefaultSignature(signatures)
  const [replySubject, setReplySubject] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replyAppliedSig, setReplyAppliedSig] = useState<string | null>(null)
  const [replyTemplateHtml, setReplyTemplateHtml] = useState<string | null>(null)
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [replySendError, setReplySendError] = useState('')
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const replySigPrefilledRef = useRef(false)

  const [deleteError, setDeleteError] = useState('')
  const [bookingOpen, setBookingOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  const aiEnabled = config?.enabled_modules?.includes('ai') ?? false
  const [replyBriefing, setReplyBriefing] = useState<{ summary: string; suggested_actions: Array<{ action: string; value: string; label: string }> } | null>(null)
  const [replyBriefingLoading, setReplyBriefingLoading] = useState(false)
  const [replyBriefingDismissed, setReplyBriefingDismissed] = useState(false)
  const replyBriefingFetchedRef = useRef(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [improveLoading, setImproveLoading] = useState(false)
  const [improveSuggestions, setImproveSuggestions] = useState<Array<{ label: string; revised_text: string }>>([])
  const [chipsDone, setChipsDone] = useState<Set<string>>(new Set())

  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then((r: any) => r.data),
  })

  const { data: ticketContact } = useQuery({
    queryKey: ['ticket-contact-booking', ticket?.contact_id],
    queryFn: () => api.get(`/contacts/${ticket.contact_id}`).then((r: any) => r.data),
    enabled: !!ticket?.contact_id && bookingEnabled,
  })

  const { data: replyContact } = useQuery({
    queryKey: ['contact', ticket?.contact_id],
    queryFn: () => api.get(`/contacts/${ticket.contact_id}`).then((r: any) => r.data),
    enabled: !!ticket?.contact_id,
    staleTime: 30_000,
  })
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => api.get(`/tickets/${id}/comments`).then((r: any) => r.data),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r: any) => r.data),
    enabled: aiEnabled,
    staleTime: 60_000,
  })
  const { data: pipelineStages } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
    enabled: aiEnabled,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (activeTab !== 'reply') return
    if (!replySubject && ticket?.subject) setReplySubject(`Re: ${ticket.subject}`)
    if (replySigPrefilledRef.current) return
    if (defaultSig) {
      setReplyBody(prev => prev || `\n\n${defaultSig.body}`)
      setReplyAppliedSig(defaultSig.body)
      replySigPrefilledRef.current = true
    }
  }, [activeTab, defaultSig, ticket?.subject])

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/tickets/${id}/status`, { status }),
    onMutate: async (status: any) => {
      await qc.cancelQueries({ queryKey: ['ticket', id] })
      const prev = qc.getQueryData(['ticket', id])
      qc.setQueryData(['ticket', id], (old: any) => old ? { ...old, status } : old)
      return { prev }
    },
    onError: (_err: any, _status: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['ticket', id], ctx.prev)
      toast.error('Failed to update status.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['ticket', id] })
      qc.invalidateQueries({ queryKey: ['setup-closed-ticket'] })
    },
  })

  const thankYouMutation = useMutation({
    mutationFn: ({ status, thank_you }: { status: string; thank_you: boolean }) =>
      api.patch(`/tickets/${id}/status`, { status, thank_you }),
    onMutate: async ({ thank_you }: any) => {
      await qc.cancelQueries({ queryKey: ['ticket', id] })
      const prev = qc.getQueryData(['ticket', id])
      qc.setQueryData(['ticket', id], (old: any) => old ? { ...old, thank_you } : old)
      return { prev }
    },
    onError: (_err: any, _v: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['ticket', id], ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const priorityMutation = useMutation({
    mutationFn: (priority: string) => api.patch(`/tickets/${id}`, { priority }),
    onMutate: async (priority: any) => {
      await qc.cancelQueries({ queryKey: ['ticket', id] })
      const prev = qc.getQueryData(['ticket', id])
      qc.setQueryData(['ticket', id], (old: any) => old ? { ...old, priority } : old)
      return { prev }
    },
    onError: (_err: any, _priority: any, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['ticket', id], ctx.prev)
      toast.error('Failed to update priority.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const snoozeMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/snooze`),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['ticket', id] })
      const prev = qc.getQueryData(['ticket', id])
      qc.setQueryData(['ticket', id], (old: any) =>
        old ? { ...old, sla_due_at: new Date(Date.now() + 86400000).toISOString() } : old)
      return { prev }
    },
    onError: (_err: any, _vars: void, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['ticket', id], ctx.prev)
      toast.error('Failed to snooze ticket.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/comments`, { body: comment, is_internal: true }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['ticket-comments', id] })
      const prev = qc.getQueryData(['ticket-comments', id])
      const optimistic = { id: 'temp-' + Date.now(), body: comment, is_internal: true, created_at: new Date().toISOString(), author_name: user?.full_name ?? 'You' }
      qc.setQueryData(['ticket-comments', id], (old: any[]) => [optimistic, ...(old ?? [])])
      return { prev }
    },
    onError: (_err: any, _vars: void, ctx: any) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['ticket-comments', id], ctx.prev)
      toast.error('Failed to save note.')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-comments', id] })
      setComment('')
    },
  })

  const replyMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('subject', replySubject.trim())
      fd.append('body', replyBody.trim())
      if (replyTemplateHtml) fd.append('html_body', replyTemplateHtml)
      replyFiles.forEach(f => fd.append('attachments', f))
      return api.post(`/tickets/${id}/send-reply`, fd, { headers: { 'Content-Type': undefined } }).then((r: any) => r.data)
    },
    onSuccess: (data: any) => {
      toast.success(`Email sent to ${data?.to ?? replyContact?.email}`)
      qc.invalidateQueries({ queryKey: ['ticket-comments', id] })
      setReplyBody('')
      setReplyFiles([])
      setReplySendError('')
      replySigPrefilledRef.current = false
      setReplySubject('')
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      setReplySendError(typeof detail === 'string' ? detail : 'Failed to send. Check your email settings.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/delete`).then((r: any) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      navigate('/tickets')
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setDeleteError(typeof detail === 'string' ? detail : 'Failed to delete ticket')
    },
  })

  const assignDeptMutation = useMutation({
    mutationFn: (department_id: string) => api.patch(`/tickets/${id}`, { department_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
    onError: () => toast.error('Failed to assign department.'),
  })

  const pipelineStageMutation = useMutation({
    mutationFn: (stage_id: string) =>
      ticket?.contact_id
        ? api.put(`/pipeline/contacts/${ticket.contact_id}/stage`, { stage_id })
        : Promise.reject('No contact'),
    onError: () => toast.error('Failed to update pipeline stage.'),
  })

  function handleReplyFocus() {
    if (replyBriefingFetchedRef.current || !id || !aiEnabled) return
    replyBriefingFetchedRef.current = true
    setReplyBriefingLoading(true)
    api.post(`/tickets/${id}/briefing`)
      .then((r: any) => setReplyBriefing(r.data))
      .catch(() => {})
      .finally(() => setReplyBriefingLoading(false))
  }

  function handleChipAction(action: string, value: string) {
    const key = `${action}:${value}`
    if (action === 'set_status') {
      setChipsDone(prev => new Set([...prev, key]))
      statusMutation.mutate(value)
    } else if (action === 'assign_department') {
      const dept = (departments ?? []).find((d: any) => d.name === value)
      if (dept) { setChipsDone(prev => new Set([...prev, key])); assignDeptMutation.mutate(dept.id) }
    } else if (action === 'move_pipeline_stage') {
      const stage = (pipelineStages ?? []).find((s: any) => s.name === value)
      if (stage) { setChipsDone(prev => new Set([...prev, key])); pipelineStageMutation.mutate(stage.id) }
    }
  }

  const t = tl

  if (!ticket) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div className="flex gap-8 items-start">
    <div className="flex-1 min-w-0">
      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-lg font-bold text-red-600">{t('ticket_delete_title')}</h2>
              <CloseButton onClick={() => setConfirmingDelete(false)} />
            </div>
            <div className="p-6 flex flex-col gap-4">
              <p className="text-sm text-slate-600">
                {t('ticket_delete_action')} <strong>{ticket.subject}</strong>? {t('ticket_delete_confirm')}
              </p>
              {deleteError && <p className="error-text">{deleteError}</p>}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirmingDelete(false)} className="btn-secondary px-4 py-2">{t('cancel')}</button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="btn-danger px-4 py-2"
                >
                  {deleteMutation.isPending ? t('ticket_deleting') : t('ticket_delete_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ticket.sla_due_at && (() => {
        const due = new Date(ticket.sla_due_at)
        const hoursLeft = (due.getTime() - Date.now()) / 3_600_000
        if (hoursLeft > 24) return null
        const overdue = hoursLeft < 0
        return (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between gap-3 ${overdue ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
            <span className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={14} className="shrink-0" />
              {overdue ? t('ticket_sla_overdue').replace('{due}', due.toLocaleString()) : t('ticket_sla_due_in').replace('{hours}', String(Math.ceil(hoursLeft))).replace('{due}', due.toLocaleString())}
            </span>
            <MutationGate>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => snoozeMutation.mutate()}
                  disabled={snoozeMutation.isPending}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${overdue ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-orange-300 text-orange-700 hover:bg-orange-100'}`}
                >
                  {t('ticket_snooze_24h')}
                </button>
                {ticket.priority !== 'urgent' && (
                  <button
                    onClick={() => priorityMutation.mutate('urgent')}
                    disabled={priorityMutation.isPending}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${overdue ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-orange-300 text-orange-700 hover:bg-orange-100'}`}
                  >
                    {t('ticket_escalate')}
                  </button>
                )}
              </div>
            </MutationGate>
          </div>
        )
      })()}

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="heading-xl text-slate-900">{ticket.subject}</h1>
        <MutationGate>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={ticket.status}
              onChange={e => statusMutation.mutate(e.target.value)}
              disabled={statusMutation.isPending}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-700 focus:outline-none focus:ring-1 focus:ring-yippie/30 focus:border-yippie disabled:opacity-50"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>
            {(ticket.status === 'resolved' || ticket.status === 'closed') && (
              <button
                onClick={() => thankYouMutation.mutate({ status: ticket.status, thank_you: !ticket.thank_you })}
                disabled={thankYouMutation.isPending}
                title="Mark this close as a pure thank you — excluded from first time right"
                className={`text-xs px-2 py-1 rounded-lg border font-semibold transition-colors disabled:opacity-50 ${
                  ticket.thank_you
                    ? 'bg-yippie-50 text-yippie-700 border-yippie-200'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t('ticket_thank_you')}
              </button>
            )}
            <select
              value={ticket.priority}
              onChange={e => priorityMutation.mutate(e.target.value)}
              disabled={priorityMutation.isPending}
              className={`text-xs px-2 py-1 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-yippie/30 focus:border-yippie disabled:opacity-50 ${PRIORITY_TEXT[ticket.priority] ?? 'text-slate-600'}`}
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
            {bookingEnabled && ticket.contact_id && ticketContact && (
              <button
                onClick={() => setBookingOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <CalendarClock size={12} />
                {t('ticket_send_booking')}
              </button>
            )}
            <button
              onClick={() => setMergeOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors"
              style={{ color: YIPPIE_BLUE, borderColor: `${YIPPIE_BLUE}55` }}
            >
              <GitMerge size={12} />
              {t('ticket_merge_btn')}
            </button>
            {canDelete && (
              <button
                onClick={() => { setDeleteError(''); setConfirmingDelete(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 size={12} />
                {t('ticket_delete_action')}
              </button>
            )}
          </div>
        </MutationGate>
      </div>

      {bookingEnabled && ticketContact && (
        <SendBookingModal
          contacts={[{ id: ticketContact.id, full_name: ticketContact.full_name }]}
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
        />
      )}

      {mergeOpen && id && (
        <MergeModal
          primaryId={id}
          contactId={ticket.contact_id ?? null}
          onClose={() => setMergeOpen(false)}
        />
      )}

      <div className="flex gap-3 mb-6 text-sm text-slate-600">
        <span>{t('ticket_source_label')} <strong className="text-slate-900">{ticket.source}</strong></span>
      </div>

      {ticket.description && (
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-200">
          {ticket.description}
        </p>
      )}

      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('ticket_comments_heading')}</h3>

      <div className="flex flex-col gap-3 mb-6">
        {comments?.map((c: any) => (
          <div key={c.id} className={`rounded-xl border p-4 ${c.is_internal ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            {c.is_internal && (
              <div className="flex items-center gap-1.5 mb-2">
                <Lock size={11} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">{t('ticket_internal_note_badge')}</p>
              </div>
            )}
            <p className="text-sm text-slate-900 whitespace-pre-wrap">{c.body}</p>
            <p className="text-xs text-slate-400 mt-2">{new Date(c.created_at).toLocaleString()}</p>
          </div>
        ))}
        {(!comments || comments.length === 0) && (
          <p className="text-sm text-slate-400">{t('ticket_no_comments')}</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={() => setActiveTab('reply')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${activeTab === 'reply' ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-50 text-slate-500 border-transparent hover:text-slate-700'}`}
          >
            <Mail size={11} />
            {t('ticket_tab_email')}
          </button>
          <button
            onClick={() => setActiveTab('internal')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${activeTab === 'internal' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-transparent hover:text-slate-700'}`}
          >
            <Lock size={11} />
            {t('ticket_tab_internal')}
          </button>
        </div>

        {activeTab === 'reply' ? (
          <MutationGate>
            {!ticket?.contact_id || !replyContact?.email ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <Mail size={20} className="text-slate-300" />
                <p className="text-sm text-slate-400">
                  {!ticket?.contact_id ? t('ticket_no_contact_reply') : t('ticket_no_email_reply')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* To (locked) */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                  <Mail size={11} className="shrink-0 text-slate-400" />
                  <span className="truncate">{replyContact.full_name} &lt;{replyContact.email}&gt;</span>
                  <Lock size={10} className="shrink-0 text-slate-300 ml-auto" />
                </div>
                {/* Subject */}
                <input
                  type="text"
                  value={replySubject}
                  onChange={e => setReplySubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                />
                {/* Toolbar */}
                <div className="flex items-center gap-2">
                  <SignaturePicker onPick={(sig: Signature) => {
                    setReplyBody(prev => swapSignature(prev, replyAppliedSig, sig.body))
                    setReplyAppliedSig(sig.body)
                  }} />
                  <TemplatePicker
                    onSelect={(tmplBody, isHtml) => {
                      const sig = replyAppliedSig ? `\n\n${replyAppliedSig}` : ''
                      if (isHtml) {
                        setReplyTemplateHtml(tmplBody)
                        setReplyBody(htmlToText(tmplBody) + sig)
                      } else {
                        setReplyTemplateHtml(null)
                        setReplyBody(tmplBody + sig)
                      }
                    }}
                    direction="down"
                  />
                  <button
                    type="button"
                    onClick={() => replyFileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    title="Attach file"
                  >
                    <Paperclip size={12} /> {t('ticket_attach_btn')}
                  </button>
                  <input
                    ref={replyFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? [])
                      setReplyFiles(prev => [...prev, ...files])
                      e.target.value = ''
                    }}
                  />
                  {aiEnabled && (
                    <>
                      <button
                        type="button"
                        disabled={generateLoading}
                        onClick={async () => {
                          setGenerateLoading(true)
                          try {
                            const r: any = await api.post(`/tickets/${id}/suggest-reply`)
                            setReplyBody(r.data.suggestion)
                            setImproveSuggestions([])
                            toast.success('Reply generated.')
                          } catch { toast.error('Failed to generate reply.') }
                          finally { setGenerateLoading(false) }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50"
                        title="Generate AI reply"
                      >
                        {generateLoading
                          ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : <Sparkles size={12} />}
                        {t('ticket_generate_btn')}
                      </button>
                      <button
                        type="button"
                        disabled={improveLoading || !replyBody.trim()}
                        onClick={async () => {
                          setImproveLoading(true)
                          try {
                            const r: any = await api.post(`/tickets/${id}/improve-reply`, { current_text: replyBody.trim() })
                            setImproveSuggestions(r.data.suggestions ?? [])
                          } catch { toast.error('Failed to get suggestions.') }
                          finally { setImproveLoading(false) }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                        title="Improve reply with AI"
                      >
                        {improveLoading
                          ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          : <Sparkles size={12} />}
                        {t('ticket_improve_btn')}
                      </button>
                    </>
                  )}
                </div>
                {/* AI briefing card */}
                {aiEnabled && (replyBriefingLoading || (replyBriefing && !replyBriefingDismissed)) && (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <Sparkles size={13} className="text-violet-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        {replyBriefingLoading
                          ? <p className="text-xs text-violet-500 animate-pulse">{t('ticket_briefing_loading')}</p>
                          : <p className="text-xs text-violet-800">{replyBriefing?.summary}</p>
                        }
                      </div>
                      <button onClick={() => setReplyBriefingDismissed(true)} className="text-violet-400 hover:text-violet-600 shrink-0"><X size={12} /></button>
                    </div>
                    {!replyBriefingLoading && (replyBriefing?.suggested_actions ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(replyBriefing?.suggested_actions ?? []).map((a: any) => {
                          const key = `${a.action}:${a.value}`
                          const done = chipsDone.has(key)
                          if (a.action === 'assign_department' && !(departments ?? []).find((d: any) => d.name === a.value)) return null
                          if (a.action === 'move_pipeline_stage' && !(pipelineStages ?? []).find((s: any) => s.name === a.value)) return null
                          return (
                            <button
                              key={key}
                              onClick={() => !done && handleChipAction(a.action, a.value)}
                              disabled={done}
                              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${done ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}
                            >
                              {done && <Check size={9} />}
                              {a.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                {/* Body */}
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  onFocus={handleReplyFocus}
                  placeholder={t('ticket_reply_placeholder')}
                  rows={6}
                  className="w-full text-sm text-slate-900 resize-none focus:outline-none placeholder-slate-400 border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                />
                {/* Improve suggestions */}
                {improveSuggestions.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('ticket_ai_suggestions_label')}</p>
                    <div className="flex flex-col gap-1.5">
                      {improveSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => { setReplyBody(s.revised_text); setImproveSuggestions([]) }}
                          className="text-xs text-left text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Attached files */}
                {replyFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {replyFiles.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg text-xs text-slate-700 font-medium">
                        <Paperclip size={11} className="text-slate-400" />
                        {f.name}
                        <button
                          type="button"
                          onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {replySendError && <p className="error-text">{replySendError}</p>}
                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Mail size={11} />
                    {t('ticket_sent_to').replace('{email}', replyContact.email)}
                  </span>
                  <button
                    onClick={() => replyMutation.mutate()}
                    disabled={!replySubject.trim() || !replyBody.trim() || replyMutation.isPending}
                    className="btn-primary px-4 py-2"
                  >
                    <Send size={13} />
                    {t('ticket_send_email_btn')}
                    {replyMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />}
                  </button>
                </div>
              </div>
            )}
          </MutationGate>
        ) : (
          <>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('ticket_internal_placeholder')}
              rows={4}
              className="w-full text-sm text-slate-900 resize-none focus:outline-none placeholder-slate-400 rounded-lg p-2 bg-amber-50"
            />
            <MutationGate>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-500">
                  <Lock size={11} />
                  {t('ticket_internal_only')}
                </span>
                <button
                  onClick={() => commentMutation.mutate()}
                  disabled={!comment.trim() || commentMutation.isPending}
                  className="btn-primary px-4 py-2"
                >
                  <Send size={13} />
                  {t('ticket_save_note_btn')}
                  {commentMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />}
                </button>
              </div>
            </MutationGate>
          </>
        )}
      </div>
    </div>
    <CustomerPanel contactId={ticket.contact_id ?? null} ticket={ticket} aiAutoScan={config?.ai_auto_scan ?? false} />
    </div>
  )
}

function MergeModal({
  primaryId,
  contactId,
  onClose,
}: {
  primaryId: string
  contactId: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const tl = useT()
  const t = tl
  const STATUS_LABELS: Record<string, string> = {
    open:        tl('status_open'),
    in_progress: tl('status_in_progress'),
    waiting:     tl('status_waiting'),
    resolved:    tl('status_resolved'),
    closed:      tl('status_closed'),
  }
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MergeCandidate | null>(null)

  // Candidates are restricted server-side to the same contact; without a
  // contact there is nothing to merge against.
  const { data, isLoading } = useQuery({
    queryKey: ['merge-candidates', contactId],
    queryFn: () =>
      api.get('/tickets', { params: { contact_id: contactId } }).then((r: any) => r.data),
    enabled: !!contactId,
  })

  const candidates: MergeCandidate[] = ((data?.items ?? []) as MergeCandidate[])
    .filter(t => t.id !== primaryId)

  const term = search.trim().toLowerCase()
  const filtered = term
    ? candidates.filter(
        t =>
          t.id.toLowerCase().includes(term) ||
          t.subject.toLowerCase().includes(term),
      )
    : candidates

  const mergeMutation = useMutation({
    mutationFn: (secondaryId: string) =>
      api.post(`/tickets/${primaryId}/merge`, { secondary_ticket_id: secondaryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', primaryId] })
      qc.invalidateQueries({ queryKey: ['ticket-comments', primaryId] })
      qc.invalidateQueries({ queryKey: ['tickets'] })
      qc.invalidateQueries({ queryKey: ['contact-tickets', contactId] })
      toast.success('Tickets merged.')
      onClose()
    },
    onError: (err: unknown) => {
      const detail =
        (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to merge tickets.')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{t('ticket_merge_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="p-6 flex flex-col gap-4">
          {!contactId ? (
            <p className="text-sm text-slate-500">
              {t('ticket_merge_no_contact')}
            </p>
          ) : selected ? (
            <>
              <p className="text-sm text-slate-600">
                {t('ticket_merge_confirm').replace('{subject}', selected.subject)}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setSelected(null)}
                  className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  {t('ticket_merge_back_btn')}
                </button>
                <button
                  onClick={() => mergeMutation.mutate(selected.id)}
                  disabled={mergeMutation.isPending}
                  className="text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ backgroundColor: YIPPIE_BLUE }}
                >
                  {mergeMutation.isPending ? t('ticket_merging') : t('ticket_merge_action')}
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('ticket_merge_search_ph')}
                className="w-full text-sm text-slate-900 border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': YIPPIE_BLUE } as CSSProperties}
              />
              <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                {isLoading ? (
                  <p className="text-sm text-slate-400 py-4 text-center">{t('ticket_merge_loading')}</p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    {t('ticket_merge_no_others')}
                  </p>
                ) : (
                  filtered.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className="w-full text-left rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-3 py-2.5 transition-colors"
                    >
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.subject}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {STATUS_LABELS[t.status] ?? t.status} · {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function draftSubject(d: any): string {
  return d.final_subject ?? d.ai_suggested_subject ?? d.inbound_subject ?? '(no subject)'
}

function LinkContactModal({ ticketId, onLinked, onClose }: { ticketId: string; onLinked: () => void; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const t = useT()

  useEffect(() => { inputRef.current?.focus() }, [])

  const { data: results, isFetching } = useQuery({
    queryKey: ['contact-search', search],
    queryFn: () => api.get('/contacts', { params: { search, limit: 8 } }).then((r: any) => r.data.items ?? r.data),
    enabled: search.length >= 1,
    staleTime: 10_000,
  })

  const link = useMutation({
    mutationFn: (contactId: string) => api.patch(`/tickets/${ticketId}`, { contact_id: contactId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Contact linked.')
      onLinked()
    },
    onError: () => toast.error('Failed to link contact.'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">{t('ticket_link_contact_title')}</h3>
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            placeholder={t('ticket_link_search_ph')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
          {isFetching && (
            <p className="text-xs text-slate-400 px-5 py-3">{t('ticket_searching')}</p>
          )}
          {!isFetching && search.length >= 1 && (!results || results.length === 0) && (
            <p className="text-xs text-slate-400 px-5 py-3">{t('ticket_no_contacts_found')}</p>
          )}
          {(results ?? []).map((c: any) => (
            <button
              key={c.id}
              onClick={() => link.mutate(c.id)}
              disabled={link.isPending}
              className="w-full text-left px-5 py-3 hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                {(c.full_name ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{c.full_name}</p>
                {c.email && <p className="text-xs text-slate-500 truncate">{c.email}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const SHIPMENT_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  registered:        { bg: 'bg-slate-100',   text: 'text-slate-600',  label: 'Registered' },
  in_transit:        { bg: 'bg-blue-100',    text: 'text-blue-700',   label: 'In transit' },
  out_for_delivery:  { bg: 'bg-amber-100',   text: 'text-amber-700',  label: 'Out for delivery' },
  delivered:         { bg: 'bg-emerald-100', text: 'text-emerald-700',label: 'Delivered' },
  exception:         { bg: 'bg-red-100',     text: 'text-red-700',    label: 'Exception' },
  returned:          { bg: 'bg-orange-100',  text: 'text-orange-700', label: 'Returned' },
  cancelled:         { bg: 'bg-slate-100',   text: 'text-slate-500',  label: 'Cancelled' },
}

function ShipmentStatusPill({ status }: { status: string }) {
  const s = SHIPMENT_STATUS_STYLES[status] ?? { bg: 'bg-slate-100', text: 'text-slate-500', label: status }
  return (
    <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

function CustomerPanel({ contactId, ticket, aiAutoScan }: { contactId: string | null; ticket: any; aiAutoScan: boolean }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const config = useTenantConfig()
  const t = useT()
  const [openDraft, setOpenDraft] = useState<any | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [contactPanelOpen, setContactPanelOpen] = useState(false)
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())

  const aiEnabled = config?.enabled_modules?.includes('ai') ?? false
  const [briefingData, setBriefingData] = useState<{ summary: string; suggested_actions: Array<{ action: string; value: string; label: string }> } | null>(null)
  const [briefingReady, setBriefingReady] = useState(false)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [briefingChipsDone, setBriefingChipsDone] = useState<Set<string>>(new Set())
  const autoScanFiredRef = useRef(false)

  const { data: panelDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r: any) => r.data),
    enabled: aiEnabled,
    staleTime: 60_000,
  })
  const { data: panelStages } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
    enabled: aiEnabled,
    staleTime: 60_000,
  })

  const panelStatusMutation = useMutation({
    mutationFn: (st: string) => api.patch(`/tickets/${ticket.id}/status`, { status: st }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
    onError: () => toast.error('Failed to update status.'),
  })
  const panelDeptMutation = useMutation({
    mutationFn: (dept_id: string) => api.patch(`/tickets/${ticket.id}`, { department_id: dept_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
    onError: () => toast.error('Failed to assign department.'),
  })
  const panelStageMutation = useMutation({
    mutationFn: (stage_id: string) =>
      ticket.contact_id
        ? api.put(`/pipeline/contacts/${ticket.contact_id}/stage`, { stage_id })
        : Promise.reject('No contact'),
    onError: () => toast.error('Failed to update pipeline stage.'),
  })

  function generateBriefing() {
    if (!aiEnabled) return
    setBriefingLoading(true)
    api.post(`/tickets/${ticket.id}/briefing`)
      .then((r: any) => {
        setBriefingData(r.data)
        setBriefingReady(true)
        toast.success('Customer briefing generated.')
      })
      .catch(() => toast.error('Failed to generate briefing.'))
      .finally(() => setBriefingLoading(false))
  }

  function handleBriefingChip(action: string, value: string) {
    const key = `${action}:${value}`
    if (action === 'set_status') {
      setBriefingChipsDone(prev => new Set([...prev, key]))
      panelStatusMutation.mutate(value)
    } else if (action === 'assign_department') {
      const dept = (panelDepts ?? []).find((d: any) => d.name === value)
      if (dept) { setBriefingChipsDone(prev => new Set([...prev, key])); panelDeptMutation.mutate(dept.id) }
    } else if (action === 'move_pipeline_stage') {
      const stage = (panelStages ?? []).find((s: any) => s.name === value)
      if (stage) { setBriefingChipsDone(prev => new Set([...prev, key])); panelStageMutation.mutate(stage.id) }
    }
  }

  useEffect(() => {
    if (aiAutoScan && aiEnabled && ticket?.id && !autoScanFiredRef.current) {
      autoScanFiredRef.current = true
      generateBriefing()
    }
  }, [aiAutoScan, aiEnabled, ticket?.id])

  const { data: contactHistory } = useQuery({
    queryKey: ['contact-history', ticket.id],
    queryFn: () => api.get(`/tickets/${ticket.id}/contact-history`).then((r: any) => r.data),
    enabled: !!contactId && !!ticket.id,
    staleTime: 30_000,
  })

  const shipmentsEnabled = config?.enabled_modules?.includes('tracking') ?? false
  const salesEnabled = config?.enabled_modules?.includes('sales') ?? false
  const saasEnabled  = config?.enabled_modules?.includes('saas') ?? false

  const { data: contact, isLoading: contactLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then((r: any) => r.data),
    enabled: !!contactId,
    retry: 1,
  })
  const { data: drafts } = useQuery({
    queryKey: ['contact-correspondence', contactId],
    queryFn: () =>
      api.get(`/inbox/drafts`, { params: { contact_id: contactId } }).then((r: any) => r.data),
    enabled: !!contactId,
  })
  const { data: ticketsData } = useQuery({
    queryKey: ['contact-tickets', contactId],
    queryFn: () => api.get(`/tickets`, { params: { contact_id: contactId } }).then((r: any) => r.data),
    enabled: !!contactId,
  })
  const { data: shipmentsData } = useQuery({
    queryKey: ['contact-shipments', contactId],
    queryFn: () => api.get('/shipments', { params: { contact_id: contactId, limit: 3 } }).then((r: any) => r.data),
    enabled: !!contactId && shipmentsEnabled,
  })
  const { data: commerceEvents } = useQuery({
    queryKey: ['contact-commerce-events', contactId],
    queryFn: () => api.get(`/sales/contacts/${contactId}/events`, { params: { limit: 5 } }).then((r: any) => r.data),
    enabled: !!contactId && salesEnabled,
  })
  const { data: saasHealth } = useQuery({
    queryKey: ['contact-saas-health', contactId],
    queryFn: () => api.get(`/saas/contacts/${contactId}/health`).then((r: any) => r.data).catch(() => null),
    enabled: !!contactId && saasEnabled,
  })
  const { data: saasEvents } = useQuery({
    queryKey: ['contact-saas-events', contactId],
    queryFn: () => api.get(`/saas/contacts/${contactId}/events`, { params: { limit: 5 } }).then((r: any) => r.data),
    enabled: !!contactId && saasEnabled,
  })

  const recent = (drafts ?? []).slice(0, 5)
  const ticketCount = ticketsData?.total ?? 0

  const scanText = `${ticket?.description ?? ''} ${ticket?.subject ?? ''}`
  const invoiceMatches = Array.from(
    new Set(scanText.match(/INV[-\s]?\d+|#\d{4,}/gi) ?? [])
  )
  const priorTickets = (ticketsData?.items ?? []).filter((t: any) => t.id !== ticket?.id)
  const priorCount = Math.max(ticketCount - 1, 0)
  const priorSubjects = priorTickets.slice(0, 2)

  return (
    <aside className="w-96 flex-shrink-0">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="heading-xl text-slate-900 mb-1">{t('ticket_contact_heading')}</h2>
          <p className="text-sm text-slate-500">{t('ticket_contact_context_desc')}</p>
        </div>
      </div>
      {/* Contact card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {!contactId ? (
          <div className="px-4 py-6 flex flex-col items-center gap-3 text-center">
            <p className="text-xs text-slate-400">{t('ticket_no_contact_linked')}</p>
            <button
              onClick={() => setLinkOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"
            >
              <UserPlus size={12} />
              {t('ticket_link_contact_btn')}
            </button>
          </div>
        ) : contactLoading ? (
          <div className="px-4 py-4 flex items-start gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                {initials(contact?.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 truncate">{contact?.full_name ?? '—'}</p>
                {contact?.email && <p className="text-xs text-slate-500 truncate">{contact.email}</p>}
                {contact?.phone && <p className="text-xs text-slate-400 truncate">{contact.phone}</p>}
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {contact?.company?.name && (
                <div className="px-4 py-3 flex items-center gap-2">
                  <span className="text-slate-400">🏢</span>
                  <span className="text-xs text-slate-700 truncate">{contact.company.name}</span>
                </div>
              )}
              {contact?.labels && contact.labels.length > 0 && (
                <div className="px-4 py-3 flex flex-wrap gap-1.5">
                  {contact.labels.map((l: any) => (
                    <span
                      key={l.id}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${l.color}20`, color: l.color }}
                    >
                      {l.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('ticket_tickets_total').replace('{count}', String(ticketCount))}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setLinkOpen(true)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                  >
                    {t('ticket_change_contact')}
                  </button>
                  <button
                    onClick={() => setContactPanelOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {t('ticket_view_contact')}
                    <ChevronRight size={11} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent correspondence */}
      {contactId && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('ticket_recent_correspondence')}</h3>
          </div>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-4">{t('ticket_no_correspondence')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((d: any) => (
                <button
                  key={d.id}
                  onClick={() => setOpenDraft(d)}
                  className="w-full text-left hover:bg-slate-50 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="text-xs text-slate-700 truncate">{draftSubject(d)}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(d.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Context scan */}
      {aiEnabled && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('ticket_context_scan')}</h3>
          </div>
          {!briefingReady ? (
            <div className="px-4 py-4 flex flex-col items-center gap-2 text-center">
              <p className="text-xs text-slate-400">{t('ticket_context_scan_desc')}</p>
              <button
                onClick={generateBriefing}
                disabled={briefingLoading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-100 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {briefingLoading
                  ? <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <Sparkles size={11} />}
                {briefingLoading ? t('ticket_generating') : t('ticket_generate_briefing')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {briefingData?.summary && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{t('ticket_ai_summary')}</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{briefingData.summary}</p>
                </div>
              )}
              {(briefingData?.suggested_actions ?? []).length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('ticket_suggested_actions')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(briefingData?.suggested_actions ?? []).map((a: any) => {
                      const key = `${a.action}:${a.value}`
                      const done = briefingChipsDone.has(key)
                      if (a.action === 'assign_department' && !(panelDepts ?? []).find((d: any) => d.name === a.value)) return null
                      if (a.action === 'move_pipeline_stage' && !(panelStages ?? []).find((s: any) => s.name === a.value)) return null
                      return (
                        <button
                          key={key}
                          onClick={() => !done && handleBriefingChip(a.action, a.value)}
                          disabled={done}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${done ? 'bg-green-100 text-green-700' : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}
                        >
                          {done && <Check size={9} />}
                          {a.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{t('ticket_invoice_heading')}</p>
                {invoiceMatches.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {invoiceMatches.map(m => (
                      <span key={m} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{m}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">{t('ticket_none_found')}</p>
                )}
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('ticket_prev_tickets')}</p>
                <p className="text-xs text-slate-700 mb-1.5">{t('ticket_tickets_total').replace('{count}', String(priorCount))}</p>
                {priorSubjects.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {priorSubjects.map((t: any) => (
                      <button key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="text-left text-xs text-blue-600 hover:text-blue-700 truncate">
                        {t.subject}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact history */}
      {contactId && (contactHistory ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('ticket_recent_contact')}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {(contactHistory ?? []).map((item: any) => {
              const isExpanded = expandedHistory.has(item.id)
              const isInternal = item.kind === 'internal_note'
              const isChat = item.kind === 'chat'
              const Icon = isChat ? MessageSquare : isInternal ? Lock : Mail
              return (
                <div
                  key={item.id}
                  className={`px-4 py-3 cursor-pointer ${isInternal ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                  onClick={() => setExpandedHistory(prev => {
                    const next = new Set(prev)
                    next.has(item.id) ? next.delete(item.id) : next.add(item.id)
                    return next
                  })}
                >
                  <div className="flex items-start gap-2">
                    <Icon size={11} className={`mt-0.5 shrink-0 ${isInternal ? 'text-slate-400' : isChat ? 'text-blue-400' : 'text-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {item.subject && <p className="text-xs font-medium text-slate-700 truncate flex-1">{item.subject}</p>}
                        {isInternal && <span className="text-[10px] font-semibold text-slate-400 bg-slate-200 rounded px-1 py-0.5 shrink-0">{t('ticket_internal_badge')}</span>}
                        <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(item.created_at)}</span>
                      </div>
                      <p className={`text-[11px] text-slate-500 ${isExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>{item.preview}</p>
                    </div>
                  </div>
                  {isExpanded && item.ticket_id && item.ticket_id !== ticket.id && (
                    <div className="mt-2 ml-5">
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/tickets/${item.ticket_id}`) }}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700"
                      >
                        View ticket →
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Orders card — visible when shipments module is enabled and contact is linked */}
      {contactId && shipmentsEnabled && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Orders</h3>
          </div>
          {(shipmentsData?.items ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-4">No orders found.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(shipmentsData?.items ?? []).map((s: any) => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {s.order_reference ?? s.tracking_number ?? '—'}
                    </p>
                    {s.tracking_number && s.order_reference && (
                      <p className="text-[10px] text-slate-400 truncate">{s.tracking_number}</p>
                    )}
                  </div>
                  <ShipmentStatusPill status={s.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commerce activity card — Sales module */}
      {contactId && salesEnabled && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Website activity</h3>
          </div>
          {(commerceEvents ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-4">No browsing data yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(commerceEvents ?? []).map((ev: any) => (
                <div key={ev.id} className="px-4 py-2.5 flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 flex-shrink-0">
                    {ev.event_type}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate flex-1">
                    {ev.properties?.url ?? ev.properties?.product ?? ''}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SaaS health card — SAAS module */}
      {contactId && saasEnabled && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Product usage</h3>
            {saasHealth && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                saasHealth.color === 'green' ? 'bg-green-100 text-green-700' :
                saasHealth.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {saasHealth.score}/100
              </span>
            )}
          </div>
          {!saasHealth && (saasEvents ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 px-4 py-4">No product data yet.</p>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {saasHealth && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex-shrink-0">Health score</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${saasHealth.color === 'green' ? 'bg-green-500' : saasHealth.color === 'amber' ? 'bg-amber-400' : 'bg-red-500'}`}
                      style={{ width: `${saasHealth.score}%` }}
                    />
                  </div>
                </div>
              )}
              {(saasEvents ?? []).slice(0, 4).map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 rounded px-1.5 py-0.5 flex-shrink-0">
                    {ev.event_type}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate flex-1">
                    {ev.properties?.feature ?? ev.properties?.step ?? ev.properties?.code ?? ''}
                  </span>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {openDraft && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900 truncate pr-2">{draftSubject(openDraft)}</h2>
              <CloseButton onClick={() => setOpenDraft(null)} />
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="text-xs text-slate-500">
                {contact?.email && <span>{contact.email}</span>}
                {' · '}
                <span>{new Date(openDraft.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {openDraft.ai_suggested_description
                  ? openDraft.ai_suggested_description.slice(0, 500)
                  : '(no preview available)'}
              </p>
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate(`/inbox/drafts/${openDraft.id}`)}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Open in inbox →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {linkOpen && (
        <LinkContactModal
          ticketId={ticket?.id}
          onLinked={() => { setLinkOpen(false); qc.invalidateQueries({ queryKey: ['ticket', ticket?.id] }) }}
          onClose={() => setLinkOpen(false)}
        />
      )}

      {contactPanelOpen && contactId && (
        <ContactSlidePanel
          contactId={contactId}
          onClose={() => setContactPanelOpen(false)}
          onNavigate={() => { setContactPanelOpen(false); navigate(`/contacts/${contactId}`) }}
        />
      )}
    </aside>
  )
}


function ContactSlidePanel({
  contactId,
  onClose,
  onNavigate,
}: {
  contactId: string
  onClose: () => void
  onNavigate: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => api.get(`/contacts/${contactId}`).then((r: any) => r.data),
  })

  useEffect(() => {
    if (contact && !editing) {
      setForm({ full_name: contact.full_name ?? '', email: contact.email ?? '', phone: contact.phone ?? '' })
    }
  }, [contact, editing])

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${contactId}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      setEditing(false)
      toast.success('Contact updated.')
    },
    onError: () => toast.error('Failed to update contact.'),
  })

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-96 max-w-full z-50 flex flex-col bg-white shadow-2xl border-l border-slate-200 animate-slide-in-right">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Contact profile</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onNavigate}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Full profile
              <ExternalLink size={11} />
            </button>
            <CloseButton onClick={onClose} className="ml-1" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {isLoading ? (
            <div className="flex flex-col gap-3 animate-pulse">
              <div className="w-14 h-14 rounded-full bg-slate-200 mx-auto" />
              <div className="h-3 bg-slate-200 rounded w-2/3 mx-auto" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2 mx-auto" />
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-2 pt-2">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold">
                  {initials(contact?.full_name)}
                </div>
                {!editing && (
                  <div className="text-center">
                    <p className="text-base font-bold text-slate-900">{contact?.full_name}</p>
                    {contact?.company?.name && <p className="text-xs text-slate-500 mt-0.5">{contact.company.name}</p>}
                  </div>
                )}
              </div>

              {editing ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setEditing(false); setForm({ full_name: contact?.full_name ?? '', email: contact?.email ?? '', phone: contact?.phone ?? '' }) }}
                      className="flex-1 border border-slate-200 text-slate-700 text-sm font-semibold py-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending || !form.full_name.trim()}
                      className="flex-1 bg-yippie text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {saveMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Email</p>
                      <p className="text-sm text-slate-800 truncate">{contact?.email ?? '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Phone</p>
                      <p className="text-sm text-slate-800 truncate">{contact?.phone ?? '—'}</p>
                    </div>
                  </div>
                  {contact?.company?.name && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Company</p>
                        <p className="text-sm text-slate-800 truncate">{contact.company.name}</p>
                      </div>
                    </div>
                  )}
                  {contact?.labels && contact.labels.length > 0 && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Labels</p>
                      <div className="flex flex-wrap gap-1.5">
                        {contact.labels.map((l: any) => (
                          <span
                            key={l.id}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${l.color}20`, color: l.color }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-2 w-full border border-slate-200 text-slate-600 text-sm font-semibold py-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Edit contact
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
