import DOMPurify from 'dompurify'
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { X, Sparkles, Send, Users, Plus, Paperclip, Palette, Pencil, Building2, CheckSquare, Square, Wand2, CalendarClock } from 'lucide-react'
import { CloseButton } from '../../../shell/CloseButton'
import { api } from '../../../api/client'
import { addFilesWithinLimits } from '../attachmentLimits'
import { TemplatePicker, htmlToText } from './TemplatePicker'
import { useAuth } from '../../../auth/useAuth'
import { useSignatures, pickDefaultSignature, swapSignature, type Signature } from '../../../hooks/useSignatures'
import { SignaturePicker } from './SignaturePicker'
import { useLinkedEmailAccounts, PROVIDER_SHORT } from '../hooks/useLinkedEmailAccounts'
import { useT } from '../../../hooks/useT'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: { id: string; name: string } | null
}

interface CompanyRow { id: string; name: string; contact_count: number }

export interface ComposeInitialState {
  recipients: { email: string; label: string }[]
  subject: string
  body: string
  fromEmail: string | null
  templateHtml?: string | null
  campaignButtonsJson?: string | null
}

export interface SendQueuedPayload {
  composeId: string
  recipientCount: number
  restoreData: ComposeInitialState
  // Set when the send was scheduled for later — the page shows a confirmation
  // toast instead of the undo bar.
  scheduledAt?: string
}

function AllContactsModal({ onAdd, onClose }: { onAdd: (email: string, label: string) => void; onClose: () => void }) {
  const t = useT()
  const [tab, setTab] = useState<'companies' | 'contacts'>('companies')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(new Set())
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => api.get<CompanyRow[]>('/contacts/companies').then((r: any) => r.data),
  })

  const { data: contactData } = useQuery({
    queryKey: ['contacts-all-picker'],
    queryFn: () => api.get<{ items: Contact[] }>('/contacts', { params: { limit: 200 } }).then((r: any) => r.data),
  })
  const allContacts = (contactData?.items ?? []).filter((c: any) => c.email)

  const allCompaniesSelected = companies.length > 0 && companies.every((c: any) => selectedCompanyIds.has(c.id))
  const allContactsSelected = allContacts.length > 0 && allContacts.every((c: any) => selectedContactIds.has(c.id))

  function toggleCompany(id: string) {
    setSelectedCompanyIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleContact(id: string) {
    setSelectedContactIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  function toggleAllCompanies() {
    setSelectedCompanyIds(allCompaniesSelected ? new Set() : new Set(companies.map((c: any) => c.id)))
  }
  function toggleAllContacts() {
    setSelectedContactIds(allContactsSelected ? new Set() : new Set(allContacts.map((c: any) => c.id)))
  }

  const selectedCount = selectedCompanyIds.size + selectedContactIds.size

  async function handleConfirm() {
    setAdding(true)
    try {
      for (const companyId of selectedCompanyIds) {
        const contacts = await api
          .get<{ id: string; full_name: string; email: string | null }[]>(`/contacts/companies/${companyId}/contacts`)
          .then((r: any) => r.data)
        contacts.filter((c: any) => c.email).forEach((c: any) => onAdd(c.email!, c.full_name))
      }
      for (const contact of allContacts.filter((c: any) => selectedContactIds.has(c.id))) {
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900">{t('inbox_compose_add_recipients')}</h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex border-b border-slate-100 shrink-0 px-2">
          <button className={tabCls('companies')} onClick={() => setTab('companies')}>
            <Building2 size={13} className="inline mr-1.5 -mt-0.5" />
            {t('inbox_compose_companies')}
            {selectedCompanyIds.size > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{selectedCompanyIds.size}</span>}
          </button>
          <button className={tabCls('contacts')} onClick={() => setTab('contacts')}>
            <Users size={13} className="inline mr-1.5 -mt-0.5" />
            {t('inbox_compose_contacts')}
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
                <span className="text-sm font-semibold text-slate-700">{t('inbox_compose_select_all_companies')}</span>
              </button>
              {companies.map((c: any) => (
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
              {companies.length === 0 && <div className="px-4 py-8 text-sm text-slate-400 text-center">{t('inbox_compose_no_companies')}</div>}
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
                <span className="text-sm font-semibold text-slate-700">{t('inbox_compose_select_all_contacts')}</span>
              </button>
              {allContacts.map((c: any) => (
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
              {allContacts.length === 0 && <div className="px-4 py-8 text-sm text-slate-400 text-center">{t('inbox_compose_no_contacts_email')}</div>}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0">
          <span className="text-sm text-slate-500">
            {selectedCount === 0 ? t('inbox_compose_nothing_selected') : t('inbox_compose_selected_n').replace('{n}', String(selectedCount))}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{t('booking_btn_cancel')}</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedCount === 0 || adding}
              className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
            >
              {adding ? t('inbox_compose_adding') : selectedCount > 0 ? t('inbox_compose_add_n').replace('{n}', String(selectedCount)) : t('inbox_compose_add_n').replace(' ({n})', '')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ContactSearchPicker({ onAdd }: { onAdd: (email: string, label: string) => void }) {
  const t = useT()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [freeEmail, setFreeEmail] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: contacts } = useQuery({
    queryKey: ['contacts-compose', search],
    queryFn: () => api.get<{ items: Contact[] }>('/contacts', { params: { search: search || undefined, limit: 8 } }).then((r: any) => r.data.items),
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
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={t('inbox_compose_search_contacts')}
        />
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
        >
          <Users size={12} />
          {t('inbox_compose_all_contacts')}
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="flex gap-2">
              <input
                className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-yippie/30"
                value={freeEmail}
                onChange={e => setFreeEmail(e.target.value)}
                placeholder={t('inbox_compose_type_email')}
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
                className="px-2 py-1 bg-yippie hover:opacity-90 text-white text-xs rounded transition-opacity"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>
          {contacts?.map((c: any) => (
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
          {search && (!contacts || contacts.filter((c: any) => c.email).length === 0) && (
            <div className="px-3 py-3 text-xs text-slate-400 text-center">{t('inbox_compose_no_contacts_found')}</div>
          )}
        </div>
      )}
    </div>
    </>
  )
}

export default function ComposeModal({
  onClose,
  aiEnabled,
  marketingEnabled,
  onSendQueued,
  initialState,
}: {
  onClose: () => void
  aiEnabled: boolean
  marketingEnabled: boolean
  onSendQueued: (payload: SendQueuedPayload) => void
  initialState?: ComposeInitialState | null
}) {
  const t = useT()
  const { user } = useAuth()
  const linkedAccounts = useLinkedEmailAccounts()
  const { data: signatures } = useSignatures()
  const defaultSig = pickDefaultSignature(signatures)
  const [appliedSig, setAppliedSig] = useState<string | null>(defaultSig?.body ?? null)
  const [recipients, setRecipients] = useState<{ email: string; label: string }[]>(initialState?.recipients ?? [])
  const [subject, setSubject] = useState(initialState?.subject ?? '')
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAiPrompt, setShowAiPrompt] = useState(false)
  const [composeFiles, setComposeFiles] = useState<File[]>([])
  const [demoResult, setDemoResult] = useState<{ demo: true } | null>(null)
  const [fromEmail, setFromEmail] = useState<string | null>(initialState?.fromEmail ?? null)
  const [body, setBody] = useState(initialState?.body ?? '')
  const sigPrefilledRef = useRef(false)

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

  const templateEditorRef = useRef<HTMLDivElement>(null)
  const templateEditFromEditor = useRef(false)

  useEffect(() => {
    if (templateEditorRef.current && !templateEditFromEditor.current) {
      templateEditorRef.current.innerHTML = DOMPurify.sanitize(templateHtml ?? '')
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
    mutationFn: () => api.post('/inbox/compose/suggest', { prompt: aiPrompt }).then((r: any) => r.data),
    onSuccess: (data: any) => {
      if (data.subject) setSubject(data.subject)
      if (data.body) {
        setBody(appliedSig ? `${data.body}\n\n${appliedSig}` : data.body)
      }
      setShowAiPrompt(false)
      setAiPrompt('')
    },
  })

  const improveMutation = useMutation({
    mutationFn: () => api.post('/inbox/compose/improve', { subject, body }).then((r: any) => r.data),
    onSuccess: (data: any) => {
      if (data.subject) setSubject(data.subject)
      if (data.body) setBody(data.body)
    },
  })

  const [sendError, setSendError] = useState('')

  const sendMutation = useMutation({
    mutationFn: (sendAtISO?: string) => {
      const fd = new FormData()
      fd.append('to', JSON.stringify(recipients.map(r => r.email)))
      fd.append('subject', subject)
      fd.append('body', body)
      if (templateHtml) fd.append('html_body', templateHtml)
      if (campaignButtonsJson) fd.append('campaign_buttons_json', campaignButtonsJson)
      composeFiles.forEach(f => fd.append('attachments', f))
      if (fromEmail) fd.append('from_email', fromEmail)
      if (sendAtISO) fd.append('send_at', sendAtISO)
      return api.post('/inbox/compose', fd, { headers: { 'Content-Type': undefined } }).then((r: any) => r.data)
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      setSendError(typeof detail === 'string' ? detail : 'Send failed. Please try again.')
    },
    onSuccess: (data: any) => {
      setSendError('')
      if (data.demo) { setDemoResult({ demo: true }); return }
      onSendQueued({
        composeId: data.compose_id,
        recipientCount: data.recipients ?? 1,
        restoreData: { recipients, subject, body, fromEmail, templateHtml, campaignButtonsJson },
        scheduledAt: data.scheduled ? data.scheduled_at : undefined,
      })
      onClose()
    },
  })

  // "Send later" — a datetime-local value ('' = off) and its popover.
  const [scheduleAt, setScheduleAt] = useState('')
  const [showScheduleMenu, setShowScheduleMenu] = useState(false)
  // min for the picker: one minute from now, formatted for datetime-local.
  const scheduleMin = (() => {
    const d = new Date(Date.now() + 60_000 - new Date().getTimezoneOffset() * 60_000)
    return d.toISOString().slice(0, 16)
  })()
  const scheduleValid = !!scheduleAt && new Date(scheduleAt).getTime() > Date.now()
  function submitScheduled() {
    if (!scheduleValid) return
    sendMutation.mutate(new Date(scheduleAt).toISOString())
  }

  const canSend = recipients.length > 0 && !!subject.trim() && (!!body.trim() || !!templateHtml) && !sendMutation.isPending

  if (demoResult) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send size={20} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">{t('inbox_compose_demo_title')}</h2>
          <p className="text-sm text-amber-600 mb-1">{t('inbox_compose_demo_notice')}</p>
          <button onClick={onClose} className="mt-6 px-6 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">
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
            sendMutation.mutate(undefined)
          }
        }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Pencil size={16} className="text-slate-400" />
            <h2 className="text-lg font-bold text-slate-900">{t('inbox_compose_title')}</h2>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {t('inbox_compose_to')} {recipients.length > 1 && <span className="font-normal text-slate-400 normal-case">{t('inbox_compose_bcc_note')}</span>}
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

          {aiEnabled && (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-blue-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('inbox_compose_ai_label')}</span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowAiPrompt(!showAiPrompt)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Sparkles size={11} />
                    {t('inbox_compose_generate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => improveMutation.mutate()}
                    disabled={!body.trim() || improveMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    <Wand2 size={11} />
                    {improveMutation.isPending ? t('inbox_compose_improving') : t('inbox_compose_improve')}
                  </button>
                </div>
              </div>
              {showAiPrompt && (
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30"
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder={t('inbox_compose_prompt_ph')}
                    onKeyDown={e => { if (e.key === 'Enter') suggestMutation.mutate() }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => suggestMutation.mutate()}
                    disabled={!aiPrompt.trim() || suggestMutation.isPending}
                    className="px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
                  >
                    {suggestMutation.isPending ? t('inbox_compose_writing') : t('inbox_compose_generate')}
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('inbox_subject_label')}</label>
            <input
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder={t('inbox_compose_subject_ph')}
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('inbox_compose_message')}</label>
              <div className="flex items-center gap-2">
                <SignaturePicker onPick={pickSignature} />
                {marketingEnabled && (
                  <TemplatePicker
                    onSelect={(tmplBody, isHtml, buttons) => {
                      const sig = appliedSig ? `\n\n${appliedSig}` : ''
                      if (isHtml) {
                        setTemplateHtml(tmplBody)
                        setCampaignButtonsJson(buttons ?? null)
                        setBody(htmlToText(tmplBody) + sig)
                      } else {
                        setTemplateHtml(null)
                        setCampaignButtonsJson(null)
                        setBody(tmplBody + sig)
                      }
                    }}
                  />
                )}
              </div>
            </div>
            {templateHtml !== null ? (
              <div className="border border-violet-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-100">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-600 uppercase tracking-wide">
                    <Palette size={11} />
                    {t('inbox_compose_rich_template')}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setTemplateHtml(null); setCampaignButtonsJson(null); setBody(appliedSig ? `\n\n${appliedSig}` : '') }}
                    className="text-violet-400 hover:text-violet-600"
                    title={t('inbox_compose_remove_template')}
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 resize-none font-[inherit]"
                rows={14}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={t('inbox_compose_body_ph')}
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
              <span>{t('inbox_compose_attach')}</span>
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
            {(user?.reply_from_email || (user?.send_from_aliases ?? []).length > 0 || linkedAccounts.length > 0) && (
              <div className="flex items-center gap-1 text-xs text-slate-500 flex-wrap">
                <span className="text-slate-400">{t('inbox_from_label')}</span>
                <button type="button" onClick={() => setFromEmail(null)}
                  className={`px-2 py-0.5 rounded-md transition-colors ${fromEmail === null ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}>
                  {t('inbox_from_shared')}
                </button>
                {user?.reply_from_email && (
                  <button type="button" onClick={() => setFromEmail(user.reply_from_email!)}
                    className={`px-2 py-0.5 rounded-md transition-colors ${fromEmail === user.reply_from_email ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}>
                    {user.reply_from_email}
                  </button>
                )}
                {(user?.send_from_aliases ?? []).map((alias: any) => (
                  <button key={alias} type="button" onClick={() => setFromEmail(alias)}
                    className={`px-2 py-0.5 rounded-md transition-colors ${fromEmail === alias ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}>
                    {alias}
                  </button>
                ))}
                {linkedAccounts.map(acct => (
                  <button key={acct.id} type="button" onClick={() => setFromEmail(acct.email_address)}
                    className={`px-2 py-0.5 rounded-md transition-colors ${fromEmail === acct.email_address ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100 text-slate-400'}`}>
                    {acct.email_address}
                    <span className="ml-1 text-[10px] text-slate-400">via {PROVIDER_SHORT[acct.provider]}</span>
                  </button>
                ))}
              </div>
            )}
            {sendError
              ? <p className="text-xs text-red-500 truncate">{sendError}</p>
              : <p className="text-xs text-slate-400 truncate">
                  {recipients.length === 0
                    ? t('inbox_compose_no_recipients')
                    : t('inbox_compose_recipient_hint')
                        .replace('{n}', String(recipients.length))
                        .replace('{s}', recipients.length !== 1 ? 's' : '')
                        .replace('{bcc}', recipients.length > 1 ? t('inbox_compose_via_bcc') : '')
                  }
                </p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{t('booking_btn_cancel')}</button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowScheduleMenu(v => !v)}
                disabled={recipients.length === 0 || !subject.trim() || (!body.trim() && !templateHtml)}
                title={t('inbox_compose_send_later')}
                className="inline-flex items-center justify-center h-[38px] w-10 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CalendarClock size={15} />
              </button>
              {showScheduleMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-10">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('inbox_compose_send_later')}</label>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    min={scheduleMin}
                    onChange={e => setScheduleAt(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30"
                  />
                  <div className="flex items-center justify-end gap-2 mt-3">
                    {scheduleAt && (
                      <button
                        type="button"
                        onClick={() => setScheduleAt('')}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                      >
                        {t('inbox_compose_schedule_clear')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { submitScheduled(); setShowScheduleMenu(false) }}
                      disabled={!canSend || !scheduleValid}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-opacity disabled:cursor-not-allowed"
                    >
                      <CalendarClock size={12} />
                      {t('inbox_compose_schedule_send')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => sendMutation.mutate(undefined)}
              disabled={!canSend}
              title="Cmd/Ctrl + Enter"
              className="inline-flex items-center justify-center gap-2 min-w-[116px] px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
            >
              <Send size={13} />
              {sendMutation.isPending ? t('inbox_compose_sending') : t('inbox_compose_send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
