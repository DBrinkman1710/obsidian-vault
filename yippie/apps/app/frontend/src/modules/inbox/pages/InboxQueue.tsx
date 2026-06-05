import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Mail, MessageSquare, ArrowRight, Pencil, X, Sparkles, Send, Users, Plus } from 'lucide-react'
import { api } from '../../../api/client'

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
}

type Tab = 'pending' | 'processed'

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
          {/* Free email entry */}
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

function ComposeModal({ onClose }: { onClose: () => void }) {
  const [recipients, setRecipients] = useState<{ email: string; label: string }[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: string[] } | null>(null)

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
    mutationFn: () => api.post('/inbox/compose', {
      to: recipients.map(r => r.email),
      subject,
      body,
    }).then(r => r.data),
    onSuccess: (data) => setResult(data),
  })

  if (result) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send size={20} className="text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Email sent</h2>
          <p className="text-sm text-slate-500 mb-1">Sent to {result.sent} recipient{result.sent !== 1 ? 's' : ''}</p>
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
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
              rows={10}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message…"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {recipients.length === 0 ? 'Add recipients to send' : `Sending to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
            {recipients.length > 1 ? ' via BCC' : ''}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={recipients.length === 0 || !subject.trim() || !body.trim() || sendMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <Send size={13} />
              {sendMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InboxQueue() {
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [showCompose, setShowCompose] = useState(false)

  const { data: pendingDrafts, isLoading: pendingLoading, isFetching } = useQuery({
    queryKey: ['drafts', 'pending'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'pending' } }).then(r => r.data),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    enabled: activeTab === 'pending',
  })

  const { data: approvedDrafts } = useQuery({
    queryKey: ['drafts', 'approved'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'approved' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: rejectedDrafts } = useQuery({
    queryKey: ['drafts', 'rejected'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'rejected' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: forwardedDrafts } = useQuery({
    queryKey: ['drafts', 'forwarded'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'forwarded' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const processedDrafts = [...(approvedDrafts ?? []), ...(rejectedDrafts ?? []), ...(forwardedDrafts ?? [])]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const drafts = activeTab === 'pending' ? pendingDrafts : processedDrafts
  const isLoading = activeTab === 'pending' ? pendingLoading : false

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-slate-500">Review AI-generated drafts from email and WhatsApp</p>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} title={isFetching ? 'Refreshing…' : 'Live'} />
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

      <div className="flex gap-2 mb-6">
        {(['pending', 'processed'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
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

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && (!drafts || drafts.length === 0) && (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <Mail size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {activeTab === 'pending' ? 'No pending messages' : 'No processed messages yet'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {drafts?.map((d: any) => {
          const isFollowUp = d.status === 'approved' && d.follow_up_at
          return (
            <Link
              key={d.id}
              to={`/inbox/drafts/${d.id}`}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-4 hover:border-blue-300 hover:shadow-md transition-all group"
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
          )
        })}
      </div>

      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} />}
    </div>
  )
}
