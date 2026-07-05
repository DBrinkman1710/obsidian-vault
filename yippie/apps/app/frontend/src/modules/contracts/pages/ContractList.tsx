import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Search, Trash2, X, Upload, Download, ChevronDown, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useSelection, Checkbox, BulkBar } from '../../../components/Selection'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'

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
  created_at: string
  updated_at: string
}

interface ContactLite { id: string; full_name: string; email: string | null }
interface CompanyLite { id: string; name: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function counterpartyOf(c: Contract): string {
  return c.contact_name || c.company_name || c.counterparty_name || '—'
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
}

function ContractFields({ form, set }: { form: FormState; set: (patch: Partial<FormState>) => void }) {
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
  }
}

// ── Add modal ─────────────────────────────────────────────────────────────────

function AddContractModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM })
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {!form ? <p className="p-6 text-sm text-slate-400">Loading…</p> : (
          <div className="p-6 flex flex-col gap-5">
            <ContractFields form={form} set={set} />

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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ContractList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [directionFilter, setDirectionFilter] = useState<'all' | 'issued' | 'received'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rightClickId, setRightClickId] = useState<string | null>(null)
  const [peekId, setPeekId] = useState<string | null>(null)

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then((r: any) => r.data),
  })

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
        <h1 className="text-2xl font-bold text-slate-900">Contracts</h1>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">
          <Plus size={15} strokeWidth={2.5} /> New Contract
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, counterparty, or type…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
        {isLoading && <p className="text-sm text-slate-400 p-6">Loading…</p>}
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
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center w-12">File</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left w-28">Created</th>
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
                  <td className="px-4 py-3 text-center">
                    {c.file_name ? <Paperclip size={14} className="text-slate-400 mx-auto" /> : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
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

      <ContextMenu state={ctx.state} onClose={ctx.close} />
      {showAdd && <AddContractModal onClose={() => setShowAdd(false)} />}
      {confirmDelete && (
        <DeleteModal ids={rightClickId ? [rightClickId] : [...selection.sel]}
          onClose={() => { setConfirmDelete(false); setRightClickId(null); selection.clear() }} />
      )}
      {peekId && <ContractPeek contractId={peekId} onClose={() => setPeekId(null)} />}
    </div>
  )
}
