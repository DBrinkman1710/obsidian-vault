import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, FileSignature, FileText, LayoutTemplate, Link2, PenLine, Plus, RefreshCw, Search, Trash2, X, Upload, Download, ChevronDown, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useSelection, Checkbox, BulkBar } from '../../../components/Selection'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { ListRowSkeleton } from '../../../shell/Skeleton'
import { CloseButton } from '../../../shell/CloseButton'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: 'draft',      label: 'Draft' },
  { value: 'sent',       label: 'Sent' },
  { value: 'active',     label: 'Active' },
  { value: 'expired',    label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
]

const STATUS_STYLES: Record<string, string> = {
  draft:      'bg-slate-100 text-slate-600',
  sent:       'bg-blue-100 text-blue-700',
  active:     'bg-green-100 text-green-700',
  expired:    'bg-amber-100 text-amber-700',
  terminated: 'bg-slate-100 text-slate-500',
}

const DIRECTION_OPTIONS = [
  { value: 'issued',   label: 'We issue' },
  { value: 'received', label: 'We receive' },
]

const VALUE_INTERVAL_OPTIONS = [
  { value: '',        label: 'No value' },
  { value: 'one_off', label: 'One off' },
  { value: 'monthly', label: 'Per month' },
  { value: 'yearly',  label: 'Per year' },
]

const RENEWAL_TERM_OPTIONS = [
  { value: 'yearly',  label: '1 year' },
  { value: 'monthly', label: '1 month' },
]

const EXPIRING_SOON_DAYS = 60

// ── Types ─────────────────────────────────────────────────────────────────────

interface Contract {
  id: string
  title: string
  contract_type: string | null
  status: string
  direction: string
  company_id: string | null
  contact_id: string | null
  counterparty_name: string | null
  company_name: string | null
  contact_name: string | null
  tags: string[]
  notes: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  start_date: string | null
  end_date: string | null
  notice_period_days: number | null
  notice_deadline: string | null
  auto_renew: boolean
  renewal_term: string | null
  value_amount: number | null
  value_interval: string | null
  currency: string
  template_id: string | null
  body: string | null
  sign_token: string | null
  sign_token_expires_at: string | null
  signed_at: string | null
  signer_name: string | null
  created_at: string
  updated_at: string
}

interface ContractTemplate {
  id: string
  name: string
  body: string
  created_at: string
  updated_at: string
}

interface RenewalsSummary {
  mrr: number
  arr: number
  one_off_total: number
  currency: string
  active_count: number
  expiring_soon_count: number
  auto_renewing_count: number
  expired_count: number
}

interface ContactLite { id: string; full_name: string; email: string | null }
interface CompanyLite { id: string; name: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function counterpartyOf(c: Contract): string {
  return c.contact_name || c.company_name || c.counterparty_name || '—'
}

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB') : '—'
}

function fmtMoney(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

function valueLabel(c: Contract): string {
  if (c.value_amount == null || !c.value_interval) return '—'
  const suffix = c.value_interval === 'monthly' ? '/mo' : c.value_interval === 'yearly' ? '/yr' : ''
  return `${fmtMoney(c.value_amount, c.currency)}${suffix}`
}

/** Days until the renewal deadline (notice deadline if set, else end date). */
function daysToDeadline(c: Contract): number | null {
  const deadline = c.notice_deadline ?? c.end_date
  if (!deadline || c.status !== 'active') return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
}

function isExpiringSoon(c: Contract): boolean {
  const days = daysToDeadline(c)
  return days !== null && days >= 0 && days <= EXPIRING_SOON_DAYS
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

async function downloadContractFile(c: Contract) {
  try {
    const res = await api.get(`/contracts/${c.id}/file`, { responseType: 'blob' })
    downloadBlob(res.data, c.file_name || 'contract', c.file_type || 'application/octet-stream')
  } catch { toast.error('Download failed') }
}

async function downloadContractPdf(id: string, title: string) {
  try {
    const res = await api.get(`/contracts/${id}/pdf`, { responseType: 'blob' })
    downloadBlob(res.data, `${title}.pdf`, 'application/pdf')
  } catch { toast.error('PDF download failed') }
}

// ── Contact typeahead ─────────────────────────────────────────────────────────

function ContactPicker({ displayName, onSelect }: {
  displayName: string; onSelect: (id: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState(displayName)
  const [debounced, setDebounced] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebounced(term.trim()), 250); return () => clearTimeout(t) }, [term])

  const { data } = useQuery({
    queryKey: ['contract-contact-search', debounced],
    queryFn: () => api.get('/contacts', { params: { search: debounced, limit: 20 } }).then((r: any) => r.data),
    enabled: open,
  })
  const results: ContactLite[] = data?.items ?? []

  return (
    <div className="relative">
      <input className={inputCls} value={term} placeholder="Search a contact…"
        onChange={e => { setTerm(e.target.value); setOpen(true); onSelect('', '') }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {results.map(c => (
            <button key={c.id} type="button"
              onMouseDown={() => { onSelect(c.id, c.full_name); setTerm(c.full_name); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
              <span className="font-medium text-slate-800">{c.full_name}</span>
              {c.email && <span className="text-slate-400 ml-2">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Company typeahead ─────────────────────────────────────────────────────────

function CompanyPicker({ displayName, onSelect }: {
  displayName: string; onSelect: (id: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState(displayName)

  const { data } = useQuery<CompanyLite[]>({
    queryKey: ['contract-companies'],
    queryFn: () => api.get('/contacts/companies').then((r: any) => r.data),
  })
  const results = useMemo(() => {
    const t = term.trim().toLowerCase()
    const all = data ?? []
    return t ? all.filter(c => c.name.toLowerCase().includes(t)) : all
  }, [data, term])

  return (
    <div className="relative">
      <input className={inputCls} value={term} placeholder="Search a company…"
        onChange={e => { setTerm(e.target.value); setOpen(true); onSelect('', '') }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
          {results.slice(0, 30).map(c => (
            <button key={c.id} type="button"
              onMouseDown={() => { onSelect(c.id, c.name); setTerm(c.name); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 font-medium text-slate-800">
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared form fields (create + edit) ─────────────────────────────────────────

interface FormState {
  title: string
  contract_type: string
  status: string
  direction: string
  company_id: string
  company_name: string
  contact_id: string
  contact_name: string
  counterparty_name: string
  notes: string
  start_date: string
  end_date: string
  notice_period_days: string
  auto_renew: boolean
  renewal_term: string
  value_amount: string
  value_interval: string
}

function ContractFields({ form, set }: { form: FormState; set: (patch: Partial<FormState>) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  return (
    <>
      <div>
        <label className={labelCls}>Title *</label>
        <input className={inputCls} value={form.title} placeholder="e.g. Service agreement — Acme BV"
          onChange={e => set({ title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Type</label>
          <input className={inputCls} value={form.contract_type} placeholder="Service, NDA, SLA…"
            onChange={e => set({ contract_type: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Direction</label>
          <select className={inputCls} value={form.direction} onChange={e => set({ direction: e.target.value })}>
            {DIRECTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={e => set({ status: e.target.value })}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Counterparty name</label>
          <input className={inputCls} value={form.counterparty_name} placeholder="Free text (optional)"
            onChange={e => set({ counterparty_name: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Company</label>
          <CompanyPicker displayName={form.company_name}
            onSelect={(id, name) => set({ company_id: id, company_name: name })} />
        </div>
        <div>
          <label className={labelCls}>Contact</label>
          <ContactPicker displayName={form.contact_name}
            onSelect={(id, name) => set({ contact_id: id, contact_name: name })} />
        </div>
      </div>
      {/* Lifecycle & value ([CONTRACT2]) */}
      <div className="border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 hover:text-slate-700 transition-colors"
        >
          {showAdvanced ? '▾' : '▸'} Term & value
        </button>
      {showAdvanced && <>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Start date</label>
            <input type="date" className={inputCls} value={form.start_date}
              onChange={e => set({ start_date: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>End date</label>
            <input type="date" className={inputCls} value={form.end_date}
              onChange={e => set({ end_date: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Notice period (days)</label>
            <input type="number" min={0} max={730} className={inputCls} value={form.notice_period_days}
              placeholder="e.g. 30" onChange={e => set({ notice_period_days: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Renewal</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 whitespace-nowrap cursor-pointer">
                <input type="checkbox" checked={form.auto_renew}
                  onChange={e => set({ auto_renew: e.target.checked })}
                  className="rounded border-slate-300 text-yippie focus:ring-yippie/30" />
                Auto renew
              </label>
              {form.auto_renew && (
                <select className={inputCls} value={form.renewal_term}
                  onChange={e => set({ renewal_term: e.target.value })}>
                  {RENEWAL_TERM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Value (€)</label>
            <input type="number" min={0} step="0.01" className={inputCls} value={form.value_amount}
              placeholder="e.g. 1200" onChange={e => set({ value_amount: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Billing interval</label>
            <select className={inputCls} value={form.value_interval}
              onChange={e => set({ value_interval: e.target.value })}>
              {VALUE_INTERVAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </>}
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea className={`${inputCls} min-h-[72px] resize-y`} value={form.notes}
          onChange={e => set({ notes: e.target.value })} placeholder="Key terms, notice period, value…" />
      </div>
    </>
  )
}

const EMPTY_FORM: FormState = {
  title: '', contract_type: '', status: 'draft', direction: 'issued',
  company_id: '', company_name: '', contact_id: '', contact_name: '',
  counterparty_name: '', notes: '',
  start_date: '', end_date: '', notice_period_days: '',
  auto_renew: false, renewal_term: 'yearly', value_amount: '', value_interval: '',
}

function toPayload(f: FormState) {
  return {
    title: f.title.trim(),
    contract_type: f.contract_type.trim() || null,
    status: f.status,
    direction: f.direction,
    company_id: f.company_id || null,
    contact_id: f.contact_id || null,
    counterparty_name: f.counterparty_name.trim() || null,
    notes: f.notes.trim() || null,
    start_date: f.start_date || null,
    end_date: f.end_date || null,
    notice_period_days: f.notice_period_days === '' ? null : Number(f.notice_period_days),
    auto_renew: f.auto_renew,
    renewal_term: f.auto_renew ? f.renewal_term || 'yearly' : null,
    value_amount: f.value_amount === '' ? null : Number(f.value_amount),
    value_interval: f.value_interval || null,
  }
}

// ── Templates modal ([CONTRACT3]) ─────────────────────────────────────────────

function TemplatesModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ['contract-templates'],
    queryFn: () => api.get('/contracts/templates').then((r: any) => r.data),
  })
  const { data: fieldsData } = useQuery<{ fields: string[] }>({
    queryKey: ['contract-merge-fields'],
    queryFn: () => api.get('/contracts/templates/fields').then((r: any) => r.data),
    staleTime: Infinity,
  })

  function select(t: ContractTemplate | null) {
    setSelectedId(t?.id ?? null)
    setName(t?.name ?? '')
    setBody(t?.body ?? '')
  }

  const save = useMutation({
    mutationFn: () => selectedId
      ? api.patch(`/contracts/templates/${selectedId}`, { name: name.trim(), body })
      : api.post('/contracts/templates', { name: name.trim(), body }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['contract-templates'] })
      toast.success(selectedId ? 'Template saved' : 'Template created')
      if (!selectedId) setSelectedId(res.data.id)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Save failed'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/contracts/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract-templates'] })
      toast.success('Template deleted')
      select(null)
    },
  })

  function insertField(field: string) {
    const el = bodyRef.current
    const token = `{{${field}}}`
    if (!el) { setBody(prev => prev + token); return }
    const start = el.selectionStart ?? body.length
    setBody(prev => prev.slice(0, start) + token + prev.slice(el.selectionEnd ?? start))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Contract templates</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="flex flex-1 min-h-0">
          {/* Template list */}
          <div className="w-56 border-r border-slate-100 p-3 overflow-y-auto shrink-0">
            <button onClick={() => select(null)}
              className="w-full mb-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-yippie border border-yippie/40 rounded-lg hover:bg-yippie/5">
              <Plus size={13} /> New template
            </button>
            {(templates ?? []).map(t => (
              <button key={t.id} onClick={() => select(t)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-0.5 truncate ${selectedId === t.id ? 'bg-yippie/10 text-slate-900 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                {t.name}
              </button>
            ))}
            {(templates ?? []).length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-3">No templates yet. Create your first one.</p>
            )}
          </div>
          {/* Editor */}
          <div className="flex-1 p-5 flex flex-col gap-3 overflow-y-auto">
            <div>
              <label className={labelCls}>Template name *</label>
              <input className={inputCls} value={name} placeholder="e.g. Service agreement"
                onChange={e => setName(e.target.value)} />
            </div>
            <div className="flex-1 flex flex-col">
              <label className={labelCls}>Contract text</label>
              <textarea ref={bodyRef} className={`${inputCls} flex-1 min-h-[260px] resize-y font-mono text-xs leading-relaxed`}
                value={body} onChange={e => setBody(e.target.value)}
                placeholder={'This service agreement is made on {{date.today}} between {{tenant.name}} and {{company.name}}…'} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1.5">Click to insert a merge field — filled in automatically when you generate a contract:</p>
              <div className="flex flex-wrap gap-1.5">
                {(fieldsData?.fields ?? []).map(f => (
                  <button key={f} type="button" onClick={() => insertField(f)}
                    className="px-2 py-0.5 text-xs font-mono bg-slate-100 text-slate-600 rounded-md hover:bg-slate-200">
                    {`{{${f}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}
                className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
                {save.isPending ? 'Saving…' : selectedId ? 'Save changes' : 'Create template'}
              </button>
              {selectedId && (
                <button type="button" onClick={() => remove.mutate(selectedId)}
                  className="px-4 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50">Delete</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Add modal ─────────────────────────────────────────────────────────────────

function AddContractModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, start_date: new Date().toISOString().split('T')[0] })
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }))

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/contracts', toPayload(form))
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        await api.post(`/contracts/${res.data.id}/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Contract created')
      onClose()
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to create contract'),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setError(''); mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">New Contract</h2>
          <CloseButton onClick={onClose} />
        </div>
        <form onSubmit={submit} className="p-6 flex flex-col gap-5">
          <ContractFields form={form} set={set} />
          <div>
            <label className={labelCls}>Document (optional)</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-yippie/50 transition-colors"
              onClick={() => fileRef.current?.click()}>
              <Upload size={20} className="text-slate-300 mx-auto mb-1.5" />
              {file ? <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    : <p className="text-sm text-slate-400">Click to attach a PDF, Word doc, or image</p>}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={mutation.isPending}
              className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
              {mutation.isPending ? 'Saving…' : 'Create contract'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail / edit peek ─────────────────────────────────────────────────────────

export function ContractPeek({ contractId, onClose }: { contractId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [error, setError] = useState('')
  const set = (patch: Partial<FormState>) => setForm(prev => (prev ? { ...prev, ...patch } : prev))

  const { data: contract } = useQuery<Contract>({
    queryKey: ['contract', contractId],
    queryFn: () => api.get(`/contracts/${contractId}`).then((r: any) => r.data),
  })

  useEffect(() => {
    if (contract && !form) {
      setForm({
        title: contract.title, contract_type: contract.contract_type ?? '',
        status: contract.status, direction: contract.direction,
        company_id: contract.company_id ?? '', company_name: contract.company_name ?? '',
        contact_id: contract.contact_id ?? '', contact_name: contract.contact_name ?? '',
        counterparty_name: contract.counterparty_name ?? '', notes: contract.notes ?? '',
        start_date: contract.start_date ?? '', end_date: contract.end_date ?? '',
        notice_period_days: contract.notice_period_days != null ? String(contract.notice_period_days) : '',
        auto_renew: contract.auto_renew, renewal_term: contract.renewal_term ?? 'yearly',
        value_amount: contract.value_amount != null ? String(contract.value_amount) : '',
        value_interval: contract.value_interval ?? '',
      })
    }
  }, [contract])  // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => api.patch(`/contracts/${contractId}`, toPayload(form!)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      toast.success('Saved')
      onClose()
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Save failed'),
  })

  const uploadFile = useMutation({
    mutationFn: async (f: File) => {
      const fd = new FormData(); fd.append('file', f)
      return api.post(`/contracts/${contractId}/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Document attached')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Upload failed'),
  })

  const removeFile = useMutation({
    mutationFn: () => api.delete(`/contracts/${contractId}/file`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contract', contractId] })
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Document removed')
    },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Contract</h2>
          <CloseButton onClick={onClose} />
        </div>
        {!form ? <p className="p-6 text-sm text-slate-400">Loading…</p> : (
          <div className="p-6 flex flex-col gap-5">
            <ContractFields form={form} set={set} />

            {/* Contract text & e-signing */}
            {contract && <SigningSection contract={contract} />}

            {/* Document */}
            <div>
              <label className={labelCls}>Document</label>
              {contract?.file_name ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip size={15} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 truncate">{contract.file_name}</span>
                    {contract.file_size != null && (
                      <span className="text-xs text-slate-400 shrink-0">{Math.round(contract.file_size / 1024)} KB</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => downloadContractFile(contract)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80">
                      <Download size={13} /> Download
                    </button>
                    <button type="button" onClick={() => removeFile.mutate()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:opacity-80">
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center cursor-pointer hover:border-yippie/50 transition-colors"
                  onClick={() => fileRef.current?.click()}>
                  <Upload size={20} className="text-slate-300 mx-auto mb-1.5" />
                  <p className="text-sm text-slate-400">{uploadFile.isPending ? 'Uploading…' : 'Click to attach a document'}</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile.mutate(f) }} />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" disabled={save.isPending} onClick={() => { if (!form.title.trim()) { setError('Title is required'); return } save.mutate() }}
                className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
                {save.isPending ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Contract text & signing ([CONTRACT3]) ─────────────────────────────────────

function SigningSection({ contract }: { contract: Contract }) {
  const qc = useQueryClient()
  const [templateId, setTemplateId] = useState('')
  const [bodyDraft, setBodyDraft] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ['contract-templates'],
    queryFn: () => api.get('/contracts/templates').then((r: any) => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['contract', contract.id] })
    qc.invalidateQueries({ queryKey: ['contracts'] })
  }

  const generate = useMutation({
    mutationFn: () => api.post(`/contracts/${contract.id}/generate`, { template_id: templateId }),
    onSuccess: () => { invalidate(); setBodyDraft(null); setRegenerating(false); toast.success('Contract text generated') },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Generation failed'),
  })

  const saveBody = useMutation({
    mutationFn: () => api.patch(`/contracts/${contract.id}`, { body: bodyDraft }),
    onSuccess: () => { invalidate(); setBodyDraft(null); toast.success('Contract text saved') },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Save failed'),
  })

  const createLink = useMutation({
    mutationFn: () => api.post(`/contracts/${contract.id}/signing`, { expires_days: 14 }),
    onSuccess: (res: any) => {
      invalidate()
      const url = `${window.location.origin}/sign/${res.data.sign_token}`
      navigator.clipboard.writeText(url)
      toast.success('Signing link copied to clipboard — valid 14 days')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Could not create signing link'),
  })

  const body = bodyDraft ?? contract.body ?? ''
  const signed = !!contract.signed_at

  return (
    <div>
      <label className={labelCls}>Contract text & signing</label>

      {signed && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-3">
          <FileSignature size={15} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            Signed by <span className="font-semibold">{contract.signer_name}</span> on{' '}
            {new Date(contract.signed_at!).toLocaleDateString('en-GB')}
          </p>
        </div>
      )}

      {!contract.body || regenerating ? (
        <div className="flex items-center gap-2">
          <select className={inputCls} value={templateId} onChange={e => setTemplateId(e.target.value)}>
            <option value="">Choose a template…</option>
            {(templates ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button type="button" disabled={!templateId || generate.isPending} onClick={() => generate.mutate()}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-yippie rounded-xl hover:opacity-90 disabled:opacity-50">
            <PenLine size={14} /> {generate.isPending ? 'Generating…' : 'Generate'}
          </button>
          {regenerating && (
            <button type="button" onClick={() => setRegenerating(false)}
              className="shrink-0 px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          )}
        </div>
      ) : (
        <>
          {!signed && (
            <textarea className={`${inputCls} min-h-[140px] resize-y font-mono text-xs leading-relaxed mb-2`}
              value={body} onChange={e => setBodyDraft(e.target.value)} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {bodyDraft !== null && bodyDraft !== contract.body && (
              <button type="button" disabled={saveBody.isPending} onClick={() => saveBody.mutate()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-yippie rounded-lg hover:opacity-90 disabled:opacity-50">
                {saveBody.isPending ? 'Saving…' : 'Save text'}
              </button>
            )}
            <button type="button" onClick={() => downloadContractPdf(contract.id, contract.title)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              <Download size={13} /> PDF
            </button>
            {!signed && (
              contract.sign_token ? (
                <button type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/sign/${contract.sign_token}`)
                    toast.success('Signing link copied')
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100">
                  <Link2 size={13} /> Copy signing link
                </button>
              ) : (
                <button type="button" disabled={createLink.isPending} onClick={() => createLink.mutate()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                  <FileSignature size={13} /> {createLink.isPending ? 'Creating…' : 'Create signing link'}
                </button>
              )
            )}
            {!signed && (templates ?? []).length > 0 && (
              <button type="button"
                onClick={() => { setBodyDraft(null); setRegenerating(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600">
                <RefreshCw size={12} /> Regenerate
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Delete confirm ─────────────────────────────────────────────────────────────

function DeleteModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api.delete('/contracts/bulk', { data: { ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success(`${ids.length} contract${ids.length === 1 ? '' : 's'} deleted`)
      onClose()
    },
    onError: () => toast.error('Failed to delete contracts'),
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Delete contracts</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Delete <span className="font-semibold text-slate-900">{ids.length}</span> contract{ids.length === 1 ? '' : 's'}? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors">
              {mutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Inline status cell ─────────────────────────────────────────────────────────

function StatusCell({ contract, onPatch }: { contract: Contract; onPatch: (id: string, status: string) => void }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={contract.status}
        onChange={e => { e.stopPropagation(); onPatch(contract.id, e.target.value) }}
        onClick={e => e.stopPropagation()}
        className="absolute inset-0 opacity-0 cursor-pointer w-full" style={{ appearance: 'none' }}>
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className={`inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full text-xs font-semibold pointer-events-none ${STATUS_STYLES[contract.status] ?? STATUS_STYLES.draft}`}>
        {STATUS_OPTIONS.find(o => o.value === contract.status)?.label ?? contract.status}
        <ChevronDown size={10} className="opacity-60 shrink-0" />
      </span>
    </div>
  )
}

// ── Renewals view ──────────────────────────────────────────────────────────────

function DeadlineChip({ contract }: { contract: Contract }) {
  const days = daysToDeadline(contract)
  if (days === null) return <span className="text-slate-300">—</span>
  const cls = days < 0 ? 'bg-red-100 text-red-700'
    : days <= 14 ? 'bg-red-100 text-red-700'
    : days <= EXPIRING_SOON_DAYS ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-500'
  const label = days < 0 ? `${-days}d overdue` : days === 0 ? 'today' : `${days}d left`
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
}

function RenewalGroup({ title, icon, contracts, empty, onOpen }: {
  title: string; icon: React.ReactNode; contracts: Contract[]; empty: string
  onOpen: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        {icon}
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <span className="text-xs font-semibold text-slate-400">{contracts.length}</span>
      </div>
      {contracts.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">{empty}</p>
      ) : (
        <table className="w-full">
          <tbody className="divide-y divide-slate-100">
            {contracts.map(c => (
              <tr key={c.id} className="cursor-pointer hover:bg-slate-50/80 transition-colors" onClick={() => onOpen(c.id)}>
                <td className="px-5 py-3 text-sm font-medium text-slate-900">{c.title}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{counterpartyOf(c)}</td>
                <td className="px-4 py-3 text-sm text-slate-500 w-28">{fmtDate(c.end_date)}</td>
                <td className="px-4 py-3 w-28"><DeadlineChip contract={c} /></td>
                <td className="px-4 py-3 text-sm text-slate-600 text-right w-32">{valueLabel(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ContractList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'all' | 'renewals'>('all')
  const [directionFilter, setDirectionFilter] = useState<'all' | 'issued' | 'received'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rightClickId, setRightClickId] = useState<string | null>(null)
  const [peekId, setPeekId] = useState<string | null>(null)

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then((r: any) => r.data),
  })

  const { data: summary } = useQuery<RenewalsSummary>({
    queryKey: ['contracts-renewals-summary'],
    queryFn: () => api.get('/contracts/renewals/summary').then((r: any) => r.data),
    enabled: view === 'renewals',
  })

  const renewalGroups = useMemo(() => {
    const all = contracts ?? []
    const bySoonest = (a: Contract, b: Contract) =>
      (a.notice_deadline ?? a.end_date ?? '9999').localeCompare(b.notice_deadline ?? b.end_date ?? '9999')
    return {
      expiringSoon: all.filter(isExpiringSoon).sort(bySoonest),
      autoRenewing: all.filter(c => c.status === 'active' && c.auto_renew).sort(bySoonest),
      expired: all.filter(c => c.status === 'expired'),
    }
  }, [contracts])

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/contracts/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contracts'] }),
    onError: () => toast.error('Status update failed'),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (contracts ?? []).filter(c => {
      if (directionFilter !== 'all' && c.direction !== directionFilter) return false
      if (!term) return true
      return c.title.toLowerCase().includes(term)
        || counterpartyOf(c).toLowerCase().includes(term)
        || (c.contract_type ?? '').toLowerCase().includes(term)
    })
  }, [contracts, search, directionFilter])

  const selection = useSelection(filtered.map(c => c.id))
  const ctx = useContextMenu()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">Contracts</h1>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {(['all', 'renewals'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 font-medium transition-colors ${view === v ? 'bg-yippie text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {v === 'all' ? 'All' : 'Renewals'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <LayoutTemplate size={15} /> Templates
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">
            <Plus size={15} strokeWidth={2.5} /> New Contract
          </button>
        </div>
      </div>

      {view === 'renewals' ? (
        <div className="flex flex-col gap-5">
          {/* Value rollup — the live MRR/ARR feed */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Contracted MRR', value: fmtMoney(summary.mrr) },
                { label: 'Contracted ARR', value: fmtMoney(summary.arr) },
                { label: 'One off value', value: fmtMoney(summary.one_off_total) },
                { label: 'Active contracts', value: String(summary.active_count) },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{s.label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          )}
          <RenewalGroup title="Expiring soon" icon={<CalendarClock size={15} className="text-amber-500" />}
            contracts={renewalGroups.expiringSoon} onOpen={setPeekId}
            empty={`Nothing due in the next ${EXPIRING_SOON_DAYS} days.`} />
          <RenewalGroup title="Auto renewing" icon={<RefreshCw size={15} className="text-green-600" />}
            contracts={renewalGroups.autoRenewing} onOpen={setPeekId}
            empty="No contracts set to auto renew." />
          <RenewalGroup title="Expired" icon={<FileText size={15} className="text-slate-400" />}
            contracts={renewalGroups.expired} onOpen={setPeekId}
            empty="No expired contracts." />
        </div>
      ) : (
      <>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, counterparty, or type…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie" />
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden text-sm">
          {(['all', 'issued', 'received'] as const).map(d => (
            <button key={d} onClick={() => setDirectionFilter(d)}
              className={`px-3 py-2 font-medium transition-colors ${directionFilter === d ? 'bg-yippie text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              {d === 'all' ? 'All' : d === 'issued' ? 'We issue' : 'We receive'}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk bar */}
      <BulkBar count={selection.count} onClear={selection.clear}
        actions={[{ label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: () => setConfirmDelete(true) }]} />

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading && <ListRowSkeleton rows={6} />}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={selection.all} indeterminate={selection.some} onChange={selection.toggleAll} ariaLabel="Select all" />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Title</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Counterparty</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left w-28">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left w-36">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left w-32">End date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right w-28">Value</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center w-12">File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className="transition-colors cursor-pointer hover:bg-slate-50/80"
                  style={{ background: selection.has(c.id) ? 'rgba(91,164,245,0.08)' : undefined }}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest('td:first-child')) return
                    if ((e.target as HTMLElement).closest('select')) return
                    setPeekId(c.id)
                  }}
                  onContextMenu={e => ctx.open(e, [
                    { header: c.title },
                    ...(c.file_name ? [{ label: 'Download file', icon: <Download size={14} />, onClick: () => downloadContractFile(c) }] : []),
                    { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => { setRightClickId(c.id); setConfirmDelete(true) } },
                  ])}>
                  <td className="px-4 py-3">
                    <Checkbox checked={selection.has(c.id)} onChange={e => selection.toggle(c.id, e)} ariaLabel={`Select ${c.title}`} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{c.title}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{counterpartyOf(c)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{c.contract_type ?? '—'}</td>
                  <td className="px-4 py-3"><StatusCell contract={c} onPatch={(id, status) => patchStatus.mutate({ id, status })} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-slate-500">{fmtDate(c.end_date)}</span>
                      {isExpiringSoon(c) && <CalendarClock size={13} className="text-amber-500 shrink-0" />}
                      {c.status === 'active' && c.auto_renew && <RefreshCw size={12} className="text-green-600 shrink-0" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{valueLabel(c)}</td>
                  <td className="px-4 py-3 text-center">
                    {c.file_name ? <Paperclip size={14} className="text-slate-400 mx-auto" /> : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <FileText size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">{search ? 'No matching contracts' : 'No contracts yet'}</p>
          </div>
        )}
      </div>
      </>
      )}

      <ContextMenu state={ctx.state} onClose={ctx.close} />
      {showAdd && <AddContractModal onClose={() => setShowAdd(false)} />}
      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}
      {confirmDelete && (
        <DeleteModal ids={rightClickId ? [rightClickId] : [...selection.sel]}
          onClose={() => { setConfirmDelete(false); setRightClickId(null); selection.clear() }} />
      )}
      {peekId && <ContractPeek contractId={peekId} onClose={() => setPeekId(null)} />}
    </div>
  )
}
