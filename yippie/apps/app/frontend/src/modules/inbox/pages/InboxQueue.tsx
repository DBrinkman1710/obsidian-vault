import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquare, ArrowRight, Pencil, X, Sparkles, Send, Users, Plus, Trash2, AlertOctagon, CheckSquare, Paperclip } from 'lucide-react'
import { api } from '../../../api/client'
import { useTenantConfig } from '../../../App'
import { useAuth } from '../../../auth/useAuth'

const SOURCE_ICON: Record<string, React.ReactNode> = {
  email: <Mail size={13} className="text-slate-400" />,
  whatsapp: <MessageSquare size={13} className="text-green-500" />,
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low:    'bg-slate-100 text-slate-600',
}

const STATUS_STYLES: Record<string, string> = {
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  forwarded: 'bg-violet-100 text-violet-700',
  bin:       'bg-slate-100 text-slate-500',
  spam:      'bg-orange-100 text-orange-700',
}

type Tab = 'pending' | 'processed'
type ProcessedFilter = 'all' | 'approved' | 'rejected' | 'forwarded' | 'bin'
type Mailbox = 'shared' | 'personal'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: string | null
}

function ContactSearchPicker({ onAdd }: { onAdd: (email: string, label: string) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [freeEmail, setFreeEmail] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const { data: contacts } = useQuery({
    queryKey: ['contacts-compose', search],
    queryFn: () => api.get<{ items: Contact[] }>('/contacts', { params: { search: search || undefined, limit: 8 } }).then(r => r.data.items),
    enabled: open && search.length > 0,
  })

  const { data: allContacts } = useQuery({
    queryKey: ['contacts-compose-all'],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', { params: { limit: 1000 } }).then(r => r.data),
    enabled: open,
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search contacts…"
        />
        <button
          type="button"
          onClick={() => {
            if (allContacts?.items) {
              const withEmail = allContacts.items.filter(c => c.email)
              withEmail.forEach(c => onAdd(c.email!, c.full_name))
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          <Users size={12} />
          All contacts ({allContacts?.total ?? 0})
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="flex gap-2">
              <input
                className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={freeEmail}
                onChange={e => setFreeEmail(e.target.value)}
                placeholder="Or type an email address directly…"
                onKeyDown={e => {
                  if (e.key === 'Enter' && freeEmail.includes('@')) {
                    onAdd(freeEmail, freeEmail)
                    setFreeEmail('')
                  }
                }}
              />
              <button
                type="button"
                onClick={() => { if (freeEmail.includes('@')) { onAdd(freeEmail, freeEmail); setFreeEmail('') } }}
                className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>
          {contacts?.map(c => (
            c.email ? (
              <button
                key={c.id} type="button"
                onMouseDown={() => { onAdd(c.email!, c.full_name); setSearch(''); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
              >
                <span className="font-medium text-slate-900">{c.full_name}</span>
                {c.company && <span className="text-slate-500 ml-2 text-xs">{c.company}</span>}
                <span className="text-slate-400 ml-2 text-xs">{c.email}</span>
              </button>
            ) : null
          ))}
          {search && (!contacts || contacts.filter(c => c.email).length === 0) && (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">No contacts with email found</div>
          )}
        </div>
      )}
    </div>
  )
}

function ComposeModal({ onClose, aiEnabled }: { onClose: () => void; aiEnabled: boolean }) {
  const [recipients, setRecipients] = useState<{ email: string; label: string }[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [composeFiles, setComposeFiles] = useState<File[]>([])
  const [result, setResult] = useState<{ sent: number; failed: string[]; demo?: boolean } | null>(null)
  const [usePersonalFrom, setUsePersonalFrom] = useState(false)
  const [queued, setQueued] = useState<{ composeId: string; recipients: number } | null>(null)
  const [undoProgress, setUndoProgress] = useState(0)
  const [undoNotice, setUndoNotice] = useState(false)
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { user } = useAuth()

  useEffect(() => () => { if (undoIntervalRef.current) clearInterval(undoIntervalRef.current) }, [])

  const addRecipient = (email: string, label: string) => {
    if (!recipients.find(r => r.email === email)) {
      setRecipients(prev => [...prev, { email, label }])
    }
  }
  const removeRecipient = (email: string) => setRecipients(prev => prev.filter(r => r.email !== email))

  const suggestMutation = useMutation({
    mutationFn: () => api.post('/inbox/compose/suggest', { prompt: aiPrompt }).then(r => r.data),
    onSuccess: (data) => {
      if (data.subject) setSubject(data.subject)
      if (data.body) setBody(data.body)
      setShowAiPrompt(false)
      setAiPrompt('')
    },
  })

  const sendMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('to', JSON.stringify(recipients.map(r => r.email)))
      fd.append('subject', subject)
      fd.append('body', body)
      composeFiles.forEach(f => fd.append('attachments', f))
      if (usePersonalFrom && user?.reply_from_email) {
        fd.append('from_email', user.reply_from_email)
      }
      return api.post('/inbox/compose', fd, { headers: { 'Content-Type': undefined } }).then(r => r.data)
    },
    onSuccess: (data) => {
      if (data.demo) { setResult(data); return }
      // Queued with an undo window — count down 5s on the local clock (the
      // server holds the email 8s, so an Undo click always lands in time).
      const start = Date.now()
      const duration = (data.undo_seconds ?? 5) * 1000
      const recipients = data.recipients ?? 1
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current)
      setQueued({ composeId: data.compose_id, recipients })
      setUndoProgress(0)
      undoIntervalRef.current = setInterval(() => {
        const pct = Math.min(100, ((Date.now() - start) / duration) * 100)
        setUndoProgress(pct)
        if (pct >= 100) {
          clearInterval(undoIntervalRef.current!)
          undoIntervalRef.current = null
          setQueued(null)
          setResult({ sent: recipients, failed: [] })
        }
      }, 100)
    },
  })

  async function handleUndoCompose() {
    if (!queued) return
    try {
      await api.post(`/inbox/drafts/${queued.composeId}/undo-send`)
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
      setQueued(null)
      setUndoProgress(0)
      setUndoNotice(true)
      setTimeout(() => setUndoNotice(false), 3000)
    } catch {
      // Too late — the email went out. Show the sent screen instead of lying.
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
      const recipients = queued.recipients
      setQueued(null)
      setUndoProgress(0)
      setResult({ sent: recipients, failed: [] })
    }
  }

  const canSend = recipients.length > 0 && !!subject.trim() && !!body.trim() && !sendMutation.isPending && !queued

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className={`w-12 h-12 ${result.demo ? 'bg-amber-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Send size={20} className={result.demo ? 'text-amber-600' : 'text-green-600'} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">{result.demo ? 'Demo mode' : 'Email sent'}</h2>
          {result.demo ? (
            <p className="text-sm text-amber-600 mb-1">This workspace is in demo mode — no email was sent.</p>
          ) : (
            <p className="text-sm text-slate-500 mb-1">Sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}</p>
          )}
          {result.failed.length > 0 && (
            <p className="text-sm text-red-500">Failed: {result.failed.join(', ')}</p>
          )}
          <button onClick={onClose} className="mt-6 px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '92vh' }}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSend) {
            e.preventDefault()
            sendMutation.mutate()
          }
        }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-slate-400" />
            <h2 className="text-lg font-bold text-slate-900">Compose email</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {/* Recipients */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              To {recipients.length > 1 && <span className="font-normal text-slate-400 normal-case">(BCC — recipients won't see each other)</span>}
            </label>
            <ContactSearchPicker onAdd={addRecipient} />
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {recipients.map(r => (
                  <span key={r.email} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    {r.label !== r.email ? `${r.label} <${r.email}>` : r.email}
                    <button type="button" onClick={() => removeRecipient(r.email)} className="text-blue-400 hover:text-blue-600">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* AI suggestion */}
          {aiEnabled && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <button
                type="button"
                onClick={() => setShowAiPrompt(!showAiPrompt)}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
              >
                <Sparkles size={13} className="text-blue-500" />
                {showAiPrompt ? 'Hide AI suggestion' : 'Use AI to write this email'}
              </button>
              {showAiPrompt && (
                <div className="mt-3 flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="e.g. Follow up with clients about their overdue invoices, polite tone"
                    onKeyDown={e => { if (e.key === 'Enter') suggestMutation.mutate() }}
                  />
                  <button
                    type="button"
                    onClick={() => suggestMutation.mutate()}
                    disabled={!aiPrompt.trim() || suggestMutation.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {suggestMutation.isPending ? 'Writing…' : 'Suggest'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject</label>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject line…"
            />
          </div>

          {/* Body */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Message</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-[inherit]"
              rows={14}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message…"
            />
          </div>
        </div>

        {composeFiles.length > 0 && (
          <div className="px-6 pb-2 flex flex-wrap gap-1.5">
            {composeFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg text-xs text-slate-600">
                <Paperclip size={10} />
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button onClick={() => setComposeFiles(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
              <Paperclip size={13} />
              <span>Attach</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files) setComposeFiles(prev => [...prev, ...Array.from(e.target.files!)])
                  e.target.value = ''
                }}
              />
            </label>
            {user?.reply_from_email && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="text-slate-400">From:</span>
                <button
                  type="button"
                  onClick={() => setUsePersonalFrom(false)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${!usePersonalFrom ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}
                >
                  Shared
                </button>
                <button
                  type="button"
                  onClick={() => setUsePersonalFrom(true)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${usePersonalFrom ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}
                >
                  {user.reply_from_email}
                </button>
              </div>
            )}
            {undoNotice
              ? <p className="text-xs text-slate-500 font-medium">Send cancelled — your draft is unchanged.</p>
              : <p className="text-xs text-slate-400">
                  {recipients.length === 0 ? 'Add recipients to send' : `Sending to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
                  {recipients.length > 1 ? ' via BCC' : ''}
                </p>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend}
              title="Cmd/Ctrl + Enter"
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <Send size={13} />
              {queued ? 'Queued…' : sendMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Undo send floating bar — same pattern as the reply panel */}
      {queued && (
        <div className="fixed bottom-5 right-5 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-slate-900 text-sm">Yippie</p>
              <p className="text-xs text-slate-400">email sent</p>
            </div>
            <button
              onClick={handleUndoCompose}
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
    </div>
  )
}

const PROCESSED_FILTERS: { value: ProcessedFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'bin',       label: 'Bin' },
]

export default function InboxQueue() {
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [mailbox, setMailbox] = useState<Mailbox>('shared')
  const [processedFilter, setProcessedFilter] = useState<ProcessedFilter>('all')
  const [showCompose, setShowCompose] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const qc = useQueryClient()
  const config = useTenantConfig()
  const { user } = useAuth()
  const aiEnabled = config?.enabled_modules?.includes('ai') ?? true

  const { data: pendingDrafts, isLoading: pendingLoading } = useQuery({
    queryKey: ['drafts', mailbox, 'pending'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'pending', mailbox } }).then(r => r.data),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    enabled: activeTab === 'pending',
  })

  const { data: approvedDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'approved'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'approved', mailbox } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: rejectedDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'rejected'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'rejected', mailbox } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: forwardedDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'forwarded'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'forwarded', mailbox } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: binDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'bin'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'bin', mailbox } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const allProcessed = [...(approvedDrafts ?? []), ...(rejectedDrafts ?? []), ...(forwardedDrafts ?? []), ...(binDrafts ?? [])]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const processedDrafts = processedFilter === 'all'
    ? allProcessed
    : allProcessed.filter((d: any) => d.status === processedFilter)

  const drafts = activeTab === 'pending' ? (pendingDrafts ?? []) : processedDrafts
  const isLoading = activeTab === 'pending' ? pendingLoading : false

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'bin' | 'spam' }) =>
      api.post('/inbox/drafts/bulk-action', { ids, action }).then(r => r.data),
    onSuccess: () => {
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['drafts'] })
    },
  })

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === drafts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(drafts.map((d: any) => d.id)))
    }
  }

  // Clear selection when switching tabs
  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab)
    setSelected(new Set())
    setProcessedFilter('all')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed header */}
      <div className="shrink-0 px-8 pt-8 pb-0 bg-slate-50">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
            {/* Mailbox switch: shared (whole team) vs personal (mail to your own address) */}
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              {([
                { value: 'shared', label: 'Shared', icon: <Users size={13} /> },
                { value: 'personal', label: 'Personal', icon: <Mail size={13} /> },
              ] as { value: Mailbox; label: string; icon: React.ReactNode }[]).map(m => (
                <button
                  key={m.value}
                  onClick={() => { setMailbox(m.value); setSelected(new Set()) }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    mailbox === m.value
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Pencil size={14} />
            Compose
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-0">
          {(['pending', 'processed'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabSwitch(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Personal mailbox without an address configured */}
        {mailbox === 'personal' && !user?.inbound_email && (
          <div className="mt-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            No personal inbox address set yet.{' '}
            <Link to="/settings/profile" className="font-semibold underline">
              Add one in Profile settings
            </Link>{' '}
            and forward your work email to it.
          </div>
        )}

        {/* Processed filter pills */}
        {activeTab === 'processed' && (
          <div className="flex gap-1.5 mt-3">
            {PROCESSED_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setProcessedFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  processedFilter === f.value
                    ? 'bg-slate-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="mt-3 flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
            <span className="text-sm font-semibold text-blue-800">{selected.size} selected</span>
            <button
              onClick={() => bulkMutation.mutate({ ids: Array.from(selected), action: 'bin' })}
              disabled={bulkMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} />
              Move to Bin
            </button>
            <button
              onClick={() => bulkMutation.mutate({ ids: Array.from(selected), action: 'spam' })}
              disabled={bulkMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
            >
              <AlertOctagon size={12} />
              Mark as Spam
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {!isLoading && drafts.length === 0 && (
          <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
            <Mail size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">
              {activeTab === 'pending' ? 'No pending messages' : 'No processed messages yet'}
            </p>
          </div>
        )}

        {drafts.length > 0 && (
          <>
            {/* Select all row */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <CheckSquare size={14} className={selected.size === drafts.length && drafts.length > 0 ? 'text-blue-600' : ''} />
                {selected.size === drafts.length && drafts.length > 0 ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {drafts.map((d: any) => {
                const isFollowUp = d.status === 'approved' && d.follow_up_at
                const isSelected = selected.has(d.id)
                return (
                  <div
                    key={d.id}
                    className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 transition-all ${
                      isSelected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={e => { e.preventDefault(); toggleSelect(d.id) }}
                      className={`shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </button>

                    {/* Card content — full click area links to draft */}
                    <Link
                      to={`/inbox/drafts/${d.id}`}
                      className="flex-1 min-w-0 flex items-start gap-3 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {SOURCE_ICON[d.source] ?? <Mail size={13} className="text-slate-400" />}
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{d.ai_suggested_subject}</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_STYLES[d.ai_suggested_priority]}`}>
                            {d.ai_suggested_priority}
                          </span>
                          {d.ai_suggested_category && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                              {d.ai_suggested_category}
                            </span>
                          )}
                          {d.status !== 'pending' && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[d.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {d.status}
                            </span>
                          )}
                          {isFollowUp && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                              Follow-up
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-1 line-clamp-2">
                          {d.ai_suggested_description?.slice(0, 120)}…
                        </p>
                        <p className="text-xs text-slate-400">{new Date(d.created_at).toLocaleString()}</p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                    </Link>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} aiEnabled={aiEnabled} />}
    </div>
  )
}
