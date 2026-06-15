import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, MessageSquare, ArrowRight, Pencil, X, Sparkles, Send, Users, Plus, Trash2, AlertOctagon, CheckSquare, Square, Paperclip, ChevronLeft, ChevronRight, Building2, Palette, Search, ChevronDown } from 'lucide-react'
import { api } from '../../../api/client'
import { addFilesWithinLimits } from '../attachmentLimits'
import { TemplatePicker, htmlToText } from '../components/TemplatePicker'
import { useTenantConfig } from '../../../App'
import { useAuth } from '../../../auth/useAuth'
import { CardListSkeleton } from '../../../shell/Skeleton'
import { useSignatures, pickDefaultSignature, swapSignature, type Signature } from '../../../hooks/useSignatures'
import { SignaturePicker } from '../components/SignaturePicker'

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

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    sent:      { label: 'Sent',      cls: 'bg-slate-100 text-slate-500' },
    delivered: { label: 'Delivered', cls: 'bg-green-50 text-green-600' },
    opened:    { label: 'Opened',    cls: 'bg-blue-50 text-blue-600' },
    clicked:   { label: 'Clicked',   cls: 'bg-purple-50 text-purple-600' },
    bounced:   { label: 'Bounced',   cls: 'bg-red-50 text-red-600' },
  }
  const s = map[status] ?? map['sent']
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${s.cls}`}>{s.label}</span>
}

type Tab = 'pending' | 'processed' | 'sent'
type ProcessedFilter = 'all' | 'approved' | 'rejected' | 'forwarded' | 'spam' | 'bin'
type Mailbox = 'shared' | 'personal'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: { id: string; name: string } | null
}

interface CompanyRow { id: string; name: string; contact_count: number }

function AllContactsModal({ onAdd, onClose }: { onAdd: (email: string, label: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'companies' | 'contacts'>('companies')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set())
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get<CompanyRow[]>('/contacts/companies').then(r => r.data),
  })

  const { data: contactData } = useQuery({
    queryKey: ['contacts-all-picker'],
    queryFn: () => api.get<{ items: Contact[] }>('/contacts', { params: { limit: 200 } }).then(r => r.data),
  })
  const allContacts = (contactData?.items ?? []).filter(c => c.email)

  const allCompaniesSelected = companies.length > 0 && companies.every(c => selectedCompanyIds.has(c.id))
  const allContactsSelected = allContacts.length > 0 && allContacts.every(c => selectedContactIds.has(c.id))

  function toggleCompany(id: string) {
    setSelectedCompanyIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleContact(id: string) {
    setSelectedContactIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAllCompanies() {
    setSelectedCompanyIds(allCompaniesSelected ? new Set() : new Set(companies.map(c => c.id)))
  }
  function toggleAllContacts() {
    setSelectedContactIds(allContactsSelected ? new Set() : new Set(allContacts.map(c => c.id)))
  }

  const selectedCount = selectedCompanyIds.size + selectedContactIds.size

  async function handleConfirm() {
    setAdding(true)
    try {
      for (const companyId of selectedCompanyIds) {
        const contacts = await api
          .get<{ id: string; full_name: string; email: string | null }[]>(`/contacts/companies/${companyId}/contacts`)
          .then(r => r.data)
        contacts.filter(c => c.email).forEach(c => onAdd(c.email!, c.full_name))
      }
      for (const contact of allContacts.filter(c => selectedContactIds.has(c.id))) {
        onAdd(contact.email!, contact.full_name)
      }
      onClose()
    } finally {
      setAdding(false)
    }
  }

  const tabCls = (t: typeof tab) =>
    `px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">Add recipients</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex border-b border-slate-100 shrink-0 px-2">
          <button className={tabCls('companies')} onClick={() => setTab('companies')}>
            <Building2 size={13} className="inline mr-1.5 -mt-0.5" />
            Companies
            {selectedCompanyIds.size > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{selectedCompanyIds.size}</span>}
          </button>
          <button className={tabCls('contacts')} onClick={() => setTab('contacts')}>
            <Users size={13} className="inline mr-1.5 -mt-0.5" />
            Contacts
            {selectedContactIds.size > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{selectedContactIds.size}</span>}
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {tab === 'companies' && (
            <>
              <button
                type="button"
                onClick={toggleAllCompanies}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
              >
                {allCompaniesSelected ? <CheckSquare size={15} className="text-blue-600 shrink-0" /> : <Square size={15} className="text-slate-400 shrink-0" />}
                <span className="text-sm font-semibold text-slate-700">Select all companies</span>
              </button>
              {companies.map(c => (
                <button
                  key={c.id} type="button"
                  onClick={() => toggleCompany(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  {selectedCompanyIds.has(c.id) ? <CheckSquare size={15} className="text-blue-600 shrink-0" /> : <Square size={15} className="text-slate-400 shrink-0" />}
                  <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{c.contact_count} contact{c.contact_count !== 1 ? 's' : ''}</span>
                </button>
              ))}
              {companies.length === 0 && <div className="px-4 py-8 text-sm text-slate-400 text-center">No companies yet</div>}
            </>
          )}

          {tab === 'contacts' && (
            <>
              <button
                type="button"
                onClick={toggleAllContacts}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left"
              >
                {allContactsSelected ? <CheckSquare size={15} className="text-blue-600 shrink-0" /> : <Square size={15} className="text-slate-400 shrink-0" />}
                <span className="text-sm font-semibold text-slate-700">Select all contacts</span>
              </button>
              {allContacts.map(c => (
                <button
                  key={c.id} type="button"
                  onClick={() => toggleContact(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-left"
                >
                  {selectedContactIds.has(c.id) ? <CheckSquare size={15} className="text-blue-600 shrink-0" /> : <Square size={15} className="text-slate-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-900">{c.full_name}</span>
                    {c.company && <span className="text-xs text-slate-400 ml-2">{c.company.name}</span>}
                    <div className="text-xs text-slate-400 truncate">{c.email}</div>
                  </div>
                </button>
              ))}
              {allContacts.length === 0 && <div className="px-4 py-8 text-sm text-slate-400 text-center">No contacts with email</div>}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <span className="text-sm text-slate-500">
            {selectedCount === 0 ? 'Nothing selected' : `${selectedCount} selected`}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedCount === 0 || adding}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {adding ? 'Adding…' : `Add${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactSearchPicker({ onAdd }: { onAdd: (email: string, label: string) => void }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [freeEmail, setFreeEmail] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: contacts } = useQuery({
    queryKey: ['contacts-compose', search],
    queryFn: () => api.get<{ items: Contact[] }>('/contacts', { params: { search: search || undefined, limit: 8 } }).then(r => r.data.items),
    enabled: open && search.length > 0,
  })

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
    {showPicker && <AllContactsModal onAdd={onAdd} onClose={() => setShowPicker(false)} />}
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
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          <Users size={12} />
          All contacts
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
                {c.company && <span className="text-slate-500 ml-2 text-xs">{c.company.name}</span>}
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
    </>
  )
}

interface ComposeInitialState {
  recipients: { email: string; label: string }[]
  subject: string
  body: string
  usePersonalFrom: boolean
  templateHtml?: string | null
  campaignButtonsJson?: string | null
}

interface SendQueuedPayload {
  composeId: string
  recipientCount: number
  restoreData: ComposeInitialState
}

function ComposeModal({
  onClose,
  aiEnabled,
  onSendQueued,
  initialState,
}: {
  onClose: () => void
  aiEnabled: boolean
  onSendQueued: (payload: SendQueuedPayload) => void
  initialState?: ComposeInitialState | null
}) {
  const { user } = useAuth()
  const { data: signatures } = useSignatures()
  const defaultSig = pickDefaultSignature(signatures)
  // Track which signature body is currently appended, so the picker can swap it.
  const [appliedSig, setAppliedSig] = useState<string | null>(defaultSig?.body ?? null)
  const [recipients, setRecipients] = useState<{ email: string; label: string }[]>(initialState?.recipients ?? [])
  const [subject, setSubject] = useState(initialState?.subject ?? '')
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [composeFiles, setComposeFiles] = useState<File[]>([])
  const [demoResult, setDemoResult] = useState<{ demo: true } | null>(null)
  const [usePersonalFrom, setUsePersonalFrom] = useState(initialState?.usePersonalFrom ?? false)
  const [body, setBody] = useState(initialState?.body ?? '')
  const sigPrefilledRef = useRef(false)

  // Signatures load async; once the default is known, prefill the empty body
  // with it (only when the compose box started blank — don't clobber a reply
  // template or restored draft passed via initialState).
  useEffect(() => {
    if (sigPrefilledRef.current) return
    if (initialState?.body) { sigPrefilledRef.current = true; return }
    if (defaultSig) {
      setBody(prev => (prev ? prev : `\n\n${defaultSig.body}`))
      setAppliedSig(defaultSig.body)
      sigPrefilledRef.current = true
    }
  }, [defaultSig, initialState?.body])

  function pickSignature(sig: Signature) {
    setBody(prev => swapSignature(prev, appliedSig, sig.body))
    setAppliedSig(sig.body)
  }
  const [templateHtml, setTemplateHtml] = useState<string | null>(initialState?.templateHtml ?? null)
  const [campaignButtonsJson, setCampaignButtonsJson] = useState<string | null>(initialState?.campaignButtonsJson ?? null)

  // Contenteditable ref for the rich template editor.
  // We manage innerHTML directly to avoid React overwriting user edits on re-render.
  const templateEditorRef = useRef<HTMLDivElement>(null)
  const templateEditFromEditor = useRef(false)

  useEffect(() => {
    if (templateEditorRef.current && !templateEditFromEditor.current) {
      templateEditorRef.current.innerHTML = templateHtml ?? ''
    }
    templateEditFromEditor.current = false
  }, [templateHtml])

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
      if (data.body) {
        setBody(appliedSig ? `${data.body}\n\n${appliedSig}` : data.body)
      }
      setShowAiPrompt(false)
      setAiPrompt('')
    },
  })

  const [sendError, setSendError] = useState('')

  const sendMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('to', JSON.stringify(recipients.map(r => r.email)))
      fd.append('subject', subject)
      fd.append('body', body)
      if (templateHtml) fd.append('html_body', templateHtml)
      if (campaignButtonsJson) fd.append('campaign_buttons_json', campaignButtonsJson)
      composeFiles.forEach(f => fd.append('attachments', f))
      if (usePersonalFrom && user?.reply_from_email) {
        fd.append('from_email', user.reply_from_email)
      }
      return api.post('/inbox/compose', fd, { headers: { 'Content-Type': undefined } }).then(r => r.data)
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      setSendError(typeof detail === 'string' ? detail : 'Send failed — please try again')
    },
    onSuccess: (data) => {
      setSendError('')
      if (data.demo) { setDemoResult({ demo: true }); return }
      // Close the modal immediately; hand the undo bar off to the parent.
      onSendQueued({
        composeId: data.compose_id,
        recipientCount: data.recipients ?? 1,
        restoreData: { recipients, subject, body, usePersonalFrom, templateHtml, campaignButtonsJson },
      })
      onClose()
    },
  })

  const canSend = recipients.length > 0 && !!subject.trim() && (!!body.trim() || !!templateHtml) && !sendMutation.isPending

  if (demoResult) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send size={20} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Demo mode</h2>
          <p className="text-sm text-amber-600 mb-1">This workspace is in demo mode — no email was sent.</p>
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
          if (user?.hotkeys_enabled === false) return
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Message</label>
              <div className="flex items-center gap-2">
                <SignaturePicker onPick={pickSignature} />
                <TemplatePicker
                  onSelect={(tmplBody, isHtml, buttons) => {
                    const sig = appliedSig ? `\n\n${appliedSig}` : ''
                    if (isHtml) {
                      setTemplateHtml(tmplBody)
                      setCampaignButtonsJson(buttons ?? null)
                      setBody(htmlToText(tmplBody) + sig)  // plain-text fallback, not shown in UI
                    } else {
                      setTemplateHtml(null)
                      setCampaignButtonsJson(null)
                      setBody(tmplBody + sig)
                    }
                  }}
                />
              </div>
            </div>
            {templateHtml !== null ? (
              <div className="border border-violet-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-100">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-600 uppercase tracking-wide">
                    <Palette size={11} />
                    Rich template — click to edit
                  </span>
                  <button
                    type="button"
                    onClick={() => { setTemplateHtml(null); setCampaignButtonsJson(null); setBody(appliedSig ? `\n\n${appliedSig}` : '') }}
                    className="text-violet-400 hover:text-violet-600"
                    title="Remove template"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div
                  ref={templateEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={e => {
                    templateEditFromEditor.current = true
                    setTemplateHtml(e.currentTarget.innerHTML)
                  }}
                  className="bg-white overflow-y-auto focus:outline-none"
                  style={{ maxHeight: '400px', minHeight: '120px' }}
                />
              </div>
            ) : (
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-[inherit]"
                rows={14}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write your message…"
              />
            )}
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

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <label className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
              <Paperclip size={13} />
              <span>Attach</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files) {
                    const { files, error } = addFilesWithinLimits(composeFiles, Array.from(e.target.files))
                    setComposeFiles(files)
                    setSendError(error)
                  }
                  e.target.value = ''
                }}
              />
            </label>
            {user?.reply_from_email && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="text-slate-400">From:</span>
                <button type="button" onClick={() => setUsePersonalFrom(false)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${!usePersonalFrom ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}>
                  Shared
                </button>
                <button type="button" onClick={() => setUsePersonalFrom(true)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${usePersonalFrom ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}>
                  {user.reply_from_email}
                </button>
              </div>
            )}
            {sendError
              ? <p className="text-xs text-red-500 truncate">{sendError}</p>
              : <p className="text-xs text-slate-400 truncate">
                  {recipients.length === 0 ? 'Add recipients to send' : `Sending to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`}
                  {recipients.length > 1 ? ' via BCC' : ''}
                </p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              onClick={() => sendMutation.mutate()}
              disabled={!canSend}
              title="Cmd/Ctrl + Enter"
              className="inline-flex items-center justify-center gap-2 min-w-[116px] px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
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

const PROCESSED_FILTERS: { value: ProcessedFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'approved',  label: 'Approved' },
  { value: 'rejected',  label: 'Rejected' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'spam',      label: 'Spam' },
  { value: 'bin',       label: 'Bin' },
]

const RETENTION_NOTES: Partial<Record<ProcessedFilter, string>> = {
  spam: 'Spam is moved to the Bin automatically after 10 working days.',
  bin:  'Items in the Bin are permanently deleted after 20 working days.',
}

const PAGE_SIZE = 9

export default function InboxQueue() {
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [mailbox, setMailbox] = useState<Mailbox>('shared')
  const [focusedIdx, setFocusedIdx] = useState<number>(-1)
  const navigate = useNavigate()
  const [processedFilter, setProcessedFilter] = useState<ProcessedFilter>('all')
  const [showCompose, setShowCompose] = useState(false)
  const [composeInitial, setComposeInitial] = useState<ComposeInitialState | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  // Shared search query — persists across Pending/Processed/Sent tab switches.
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showProcessedFilter, setShowProcessedFilter] = useState(false)
  const processedFilterRef = useRef<HTMLDivElement>(null)
  // Undo bar state (lives here so the modal can close immediately on send)
  const [pendingCompose, setPendingCompose] = useState<{ composeId: string; recipientCount: number; restoreData: ComposeInitialState } | null>(null)
  const [undoProgress, setUndoProgress] = useState(0)
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qc = useQueryClient()
  const config = useTenantConfig()
  const { user } = useAuth()
  const { data: signatures } = useSignatures()
  const defaultSigBody = pickDefaultSignature(signatures)?.body ?? null
  const aiEnabled = config?.enabled_modules?.includes('ai') ?? true

  useEffect(() => () => { if (undoIntervalRef.current) clearInterval(undoIntervalRef.current) }, [])

  useEffect(() => { setFocusedIdx(-1) }, [activeTab, mailbox])

  // Debounce the search box so each keystroke doesn't fire a backend query.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset to the first page whenever the search term changes.
  useEffect(() => { setPage(0) }, [debouncedSearch])

  // Close the Processed filter dropdown on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (processedFilterRef.current && !processedFilterRef.current.contains(e.target as Node)) {
        setShowProcessedFilter(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Trending topics — derived from recent draft subjects, refreshed every 15 min.
  const { data: trending } = useQuery({
    queryKey: ['inbox-trending'],
    queryFn: () => api.get<{ topics: string[] }>('/inbox/trending').then(r => r.data.topics),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (user?.hotkeys_enabled === false) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'c' && !showCompose) { setShowCompose(true); setComposeInitial(null) }
      if (e.key === 'Escape' && showCompose) { setShowCompose(false); setComposeInitial(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user?.hotkeys_enabled, showCompose])

  const handleSendQueued = useCallback((payload: SendQueuedPayload) => {
    setPendingCompose({ composeId: payload.composeId, recipientCount: payload.recipientCount, restoreData: payload.restoreData })
    setUndoProgress(0)
    const start = Date.now()
    const duration = 5000
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current)
    undoIntervalRef.current = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / duration) * 100)
      setUndoProgress(pct)
      if (pct >= 100) {
        clearInterval(undoIntervalRef.current!)
        undoIntervalRef.current = null
        setPendingCompose(null)
        qc.invalidateQueries({ queryKey: ['drafts'] })
      }
    }, 100)
  }, [qc])

  async function handleUndoCompose() {
    if (!pendingCompose) return
    const restoreData = pendingCompose.restoreData
    try {
      await api.post(`/inbox/drafts/${pendingCompose.composeId}/undo-send`)
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
      setPendingCompose(null)
      setUndoProgress(0)
      setComposeInitial(restoreData)
      setShowCompose(true)
    } catch {
      if (undoIntervalRef.current) { clearInterval(undoIntervalRef.current); undoIntervalRef.current = null }
      setPendingCompose(null)
      setUndoProgress(0)
      qc.invalidateQueries({ queryKey: ['drafts'] })
    }
  }

  const trackingEnabled = config?.enabled_modules?.includes('emailtracking')

  const searchParam = debouncedSearch || undefined

  const { data: sentEvents, isLoading: sentLoading } = useQuery({
    queryKey: ['activity-sent'],
    queryFn: () => api.get('/activity', { params: { limit: 500 } }).then(r =>
      (r.data as any[]).filter((e: any) => e.event_type === 'email.replied' || e.event_type === 'email.composed')
    ),
    enabled: activeTab === 'sent' && !trackingEnabled,
  })

  const { data: outboundEmails, isLoading: outboundLoading } = useQuery({
    queryKey: ['outbound-emails', searchParam],
    queryFn: () => api.get('/emailtracking/outbound', { params: { limit: 200, q: searchParam } }).then(r => r.data as any[]),
    enabled: activeTab === 'sent' && !!trackingEnabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })

  const { data: pendingDrafts, isLoading: pendingLoading } = useQuery({
    queryKey: ['drafts', mailbox, 'pending', searchParam],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'pending', mailbox, q: searchParam } }).then(r => r.data),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    enabled: activeTab === 'pending',
  })

  const { data: approvedDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'approved', searchParam],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'approved', mailbox, q: searchParam } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: rejectedDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'rejected', searchParam],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'rejected', mailbox, q: searchParam } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: forwardedDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'forwarded', searchParam],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'forwarded', mailbox, q: searchParam } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: spamDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'spam', searchParam],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'spam', mailbox, q: searchParam } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: binDrafts } = useQuery({
    queryKey: ['drafts', mailbox, 'bin', searchParam],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'bin', mailbox, q: searchParam } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const allProcessed = [...(approvedDrafts ?? []), ...(rejectedDrafts ?? []), ...(forwardedDrafts ?? []), ...(spamDrafts ?? []), ...(binDrafts ?? [])]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const processedDrafts = processedFilter === 'all'
    ? allProcessed
    : allProcessed.filter((d: any) => d.status === processedFilter)

  const allDrafts = activeTab === 'pending' ? (pendingDrafts ?? []) : activeTab === 'sent' ? [] : processedDrafts
  const isLoading = activeTab === 'pending' ? pendingLoading : activeTab === 'sent' ? (trackingEnabled ? outboundLoading : sentLoading) : false

  // Client-side pagination — the full filtered list is already in memory.
  const totalPages = Math.max(1, Math.ceil(allDrafts.length / PAGE_SIZE))
  const pageCount = totalPages
  const safePage = Math.min(page, pageCount - 1)
  const pageDrafts = allDrafts.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Sent tab: the non-tracking (activity) path has no backend search, so filter
  // it client-side to keep search behaviour consistent across all three tabs.
  const filteredSentEvents = (sentEvents ?? []).filter((ev: any) => {
    if (!debouncedSearch) return true
    const q = debouncedSearch.toLowerCase()
    return (
      (ev.payload?.subject ?? '').toLowerCase().includes(q) ||
      (ev.payload?.to ?? '').toLowerCase().includes(q) ||
      (ev.payload?.preview ?? '').toLowerCase().includes(q)
    )
  })

  // Sent tab pagination — 9 mails/page, mirroring the Pending cadence (PAGE_SIZE).
  const sentList: any[] = activeTab === 'sent'
    ? (trackingEnabled ? (outboundEmails ?? []) : filteredSentEvents)
    : []
  const sentPageCount = Math.max(1, Math.ceil(sentList.length / PAGE_SIZE))
  const sentSafePage = Math.min(page, sentPageCount - 1)
  const pageSentList = sentList.slice(sentSafePage * PAGE_SIZE, (sentSafePage + 1) * PAGE_SIZE)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (user?.hotkeys_enabled === false) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'j') setFocusedIdx(i => Math.min(i + 1, pageDrafts.length - 1))
      if (e.key === 'k') setFocusedIdx(i => Math.max(i - 1, 0))
      if (e.key === 'r' && focusedIdx >= 0 && pageDrafts[focusedIdx]) {
        navigate(`/inbox/drafts/${pageDrafts[focusedIdx].id}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [user?.hotkeys_enabled, pageDrafts, focusedIdx, navigate])

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
    if (selected.size === allDrafts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allDrafts.map((d: any) => d.id)))
    }
  }

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab)
    setSelected(new Set())
    setProcessedFilter('all')
    setPage(0)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Fixed header */}
      <div className="shrink-0 px-8 pt-8 pb-0 bg-slate-50">
        <div className="flex items-start justify-between mb-3">
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
                  onClick={() => { setMailbox(m.value); setSelected(new Set()); setPage(0) }}
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
          <div className="flex flex-col items-stretch gap-2">
            <button
              onClick={() => {
                setComposeInitial(mailbox === 'personal' && !!user?.inbound_email ? {
                  recipients: [],
                  subject: '',
                  body: defaultSigBody ? `\n\n${defaultSigBody}` : '',
                  usePersonalFrom: true,
                } : null)
                setShowCompose(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Pencil size={14} />
              Compose
            </button>
            <TemplatePicker
              direction="down"
              triggerIconSize={14}
              triggerClassName="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors w-full"
              onSelect={(tmplBody, isHtml, buttons) => {
                const text = isHtml ? htmlToText(tmplBody) : tmplBody
                setComposeInitial({
                  recipients: [],
                  subject: '',
                  body: defaultSigBody ? `${text}\n\n${defaultSigBody}` : text,
                  usePersonalFrom: false,
                  templateHtml: isHtml ? tmplBody : null,
                  campaignButtonsJson: isHtml ? (buttons ?? null) : null,
                })
                setShowCompose(true)
              }}
            />
          </div>
        </div>

        {/* Tabs + inline search (shared across all three tabs) */}
        <div className="flex items-center gap-2 mb-0">
          {(['pending', 'processed', 'sent'] as Tab[]).map(tab => (
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
          <div className="relative ml-auto w-72 max-w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inbox…"
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-yippie focus:border-transparent transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Trending topics — shown when the search box is empty */}
        {!search && trending && trending.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2">
            <span className="text-xs text-slate-300">Trending:</span>
            {trending.map(topic => (
              <button
                key={topic}
                onClick={() => setSearch(topic)}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>
        )}

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

        {/* Processed filter — single dropdown (same options as the old pills) */}
        {activeTab === 'processed' && (
          <div ref={processedFilterRef} className="relative mt-3 inline-block">
            <button
              onClick={() => setShowProcessedFilter(o => !o)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {PROCESSED_FILTERS.find(f => f.value === processedFilter)?.label ?? 'All'}
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${showProcessedFilter ? 'rotate-180' : ''}`} />
            </button>
            {showProcessedFilter && (
              <div className="absolute left-0 top-full mt-1 z-20 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                {PROCESSED_FILTERS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => { setProcessedFilter(f.value); setPage(0); setShowProcessedFilter(false) }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${
                      processedFilter === f.value
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'processed' && RETENTION_NOTES[processedFilter] && (
          <p className="mt-2 text-xs text-slate-400">{RETENTION_NOTES[processedFilter]}</p>
        )}

        {/* Sent tab description */}
        {activeTab === 'sent' && (
          <p className="mt-3 text-xs text-slate-400">All outbound mail sent by your team.</p>
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
        {/* Sent tab content */}
        {activeTab === 'sent' && (
          <>
            {isLoading && <CardListSkeleton rows={5} />}
            {!isLoading && sentList.length === 0 && (
              <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
                <Send size={32} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium">
                  {debouncedSearch ? 'No sent mail matches your search' : 'No sent mail yet'}
                </p>
              </div>
            )}
            {trackingEnabled && sentList.length > 0 && (
              <div className="flex flex-col gap-3">
                {pageSentList.map((em: any) => {
                  const CardEl = em.draft_id ? Link : 'div'
                  const cardProps = em.draft_id ? { to: `/inbox/drafts/${em.draft_id}` } : {}
                  return (
                    <CardEl
                      key={em.id}
                      {...(cardProps as any)}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3 transition-all hover:border-blue-300 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Send size={13} className="text-slate-400 shrink-0" />
                          <span className="text-sm font-semibold text-slate-900 truncate">{em.subject ?? '(no subject)'}</span>
                          {statusBadge(em.status)}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${em.kind === 'compose' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {em.kind === 'compose' ? 'Composed' : 'Reply'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">To: {em.to_email}</p>
                        {em.delivered_at && (
                          <p className="text-xs text-slate-400 mt-0.5">Delivered: {new Date(em.delivered_at).toLocaleString()}</p>
                        )}
                        {em.opened_at && (
                          <p className="text-xs text-blue-500 mt-0.5">Opened: {new Date(em.opened_at).toLocaleString()}</p>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">{new Date(em.created_at).toLocaleString()}</p>
                    </CardEl>
                  )
                })}
              </div>
            )}
            {!trackingEnabled && sentList.length > 0 && (
              <div className="flex flex-col gap-3">
                {pageSentList.map((ev: any) => {
                  const draftId = ev.payload?.draft_id
                  const CardEl = draftId ? Link : 'div'
                  const cardProps = draftId ? { to: `/inbox/drafts/${draftId}` } : {}
                  return (
                    <CardEl
                      key={ev.id}
                      {...(cardProps as any)}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3 transition-all hover:border-blue-300 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Send size={13} className="text-slate-400 shrink-0" />
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {ev.payload?.subject ?? '(no subject)'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${ev.event_type === 'email.composed' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {ev.event_type === 'email.composed' ? 'Composed' : 'Reply'}
                          </span>
                        </div>
                        {ev.payload?.to && <p className="text-xs text-slate-500">To: {ev.payload.to}</p>}
                        {ev.payload?.preview && <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{ev.payload.preview}</p>}
                      </div>
                      <p className="text-xs text-slate-400 shrink-0">{new Date(ev.created_at).toLocaleString()}</p>
                    </CardEl>
                  )
                })}
              </div>
            )}

            {/* Sent pagination — 9 mails per page (matches Pending cadence) */}
            {sentList.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-5">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={sentSafePage === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Page {sentSafePage + 1} of {sentPageCount}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(sentPageCount - 1, p + 1))}
                  disabled={sentSafePage >= sentPageCount - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}

        {activeTab !== 'sent' && isLoading && <CardListSkeleton rows={5} />}
        {activeTab !== 'sent' && !isLoading && allDrafts.length === 0 && (
          <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
            <Mail size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">
              {activeTab === 'pending' ? 'No pending messages' : 'No processed messages yet'}
            </p>
          </div>
        )}

        {activeTab !== 'sent' && allDrafts.length > 0 && (
          <>
            {/* Sticky select-all row */}
            <div className="sticky top-0 z-10 flex items-center justify-between py-2 bg-slate-50">
              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <CheckSquare size={14} className={selected.size === allDrafts.length && allDrafts.length > 0 ? 'text-blue-600' : ''} />
                {selected.size === allDrafts.length && allDrafts.length > 0 ? 'Deselect all' : `Select all (${allDrafts.length})`}
              </button>
              {totalPages > 1 && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ←
                  </button>
                  <span>{page + 1} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    →
                  </button>
                </div>
              )}
            </div>


            <div className="flex flex-col gap-3">
              {pageDrafts.map((d: any, index: number) => {
                const isFollowUp = d.status === 'approved' && d.follow_up_at
                const followUpDate = isFollowUp ? new Date(d.follow_up_at) : null
                const isUrgent = followUpDate && (followUpDate.getTime() - Date.now()) <= 24 * 60 * 60 * 1000
                const isSelected = selected.has(d.id)
                const isFocused = focusedIdx === index
                return (
                  <div
                    key={d.id}
                    className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 transition-all ${
                      isFocused ? 'border-blue-400 ring-2 ring-blue-200' : isSelected ? 'border-blue-300 ring-1 ring-blue-200' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
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
                          {d.ai_status === 'queued' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-600 animate-pulse">
                              <Sparkles size={11} />
                              Analyzing…
                            </span>
                          )}
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
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              {isUrgent ? '⚠ Follow-up due' : 'Follow-up'}
                            </span>
                          )}
                        </div>
                        {d.inbound_subject && d.inbound_subject !== d.ai_suggested_subject && (
                          <p className="text-xs text-slate-400 mb-0.5 truncate">
                            Subject: {d.inbound_subject}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 mb-1 line-clamp-2">
                          {d.ai_suggested_description?.slice(0, 120)}…
                        </p>
                        <p className="text-xs text-slate-400">
                          {new Date(d.created_at).toLocaleString()}
                          {d.inbound_to && <span className="ml-2">· to {d.inbound_to}</span>}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                    </Link>
                  </div>
                )
              })}
            </div>

            {/* Pagination — only when the list overflows one page */}
            {allDrafts.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-5">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="text-xs text-slate-500 font-medium">
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => { setShowCompose(false); setComposeInitial(null) }}
          aiEnabled={aiEnabled}
          onSendQueued={handleSendQueued}
          initialState={composeInitial}
        />
      )}

      {/* Undo bar — shown after compose send, outside the modal */}
      {pendingCompose && (
        <div className="fixed bottom-5 right-5 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-slate-900 text-sm">Yippie</p>
              <p className="text-xs text-slate-400">sending to {pendingCompose.recipientCount} recipient{pendingCompose.recipientCount !== 1 ? 's' : ''}…</p>
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
