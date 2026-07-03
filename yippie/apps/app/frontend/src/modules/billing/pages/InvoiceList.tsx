import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt, Plus, Search, Trash2, Download, Upload, X, Mail, FileDown, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useSelection, Checkbox, BulkBar } from '../../../components/Selection'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { useT } from '../../../hooks/useT'
import { InvoicePeek } from './InvoiceDetail'

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_STATUS_OPTIONS = [
  { value: 'draft',    label: 'Draft' },
  { value: 'pending',  label: 'Pending' },
  { value: 'sent',     label: 'Sent' },
  { value: 'received', label: 'Received' },
  { value: 'paid',     label: 'Paid' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'void',     label: 'Void' },
  { value: 'not_sent', label: 'Not Sent' },
]

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-600',
  sent:     'bg-blue-100 text-blue-700',
  paid:     'bg-green-100 text-green-700',
  overdue:  'bg-red-100 text-red-700',
  void:     'bg-slate-100 text-slate-500',
  pending:  'bg-amber-100 text-amber-700',
  received: 'bg-green-100 text-green-700',
  not_sent: 'bg-slate-100 text-slate-500',
}

const VAT_RATES = [21, 9, 0]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Invoice {
  id: string
  contact_id: string
  contact_name: string | null
  invoice_number: string
  status: string
  total_cents: number
  currency: string
  due_date: string | null
  created_at: string
}

interface ContactLite {
  id: string
  full_name: string
  email: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function fmtCents(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-EU', { style: 'currency', currency }).format(cents / 100)
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// ── Contact typeahead ─────────────────────────────────────────────────────────

function ContactPicker({ value, displayName, onSelect }: {
  value: string; displayName: string; onSelect: (id: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState(displayName)
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  const { data } = useQuery({
    queryKey: ['contact-search', debounced],
    queryFn: () => api.get('/contacts', { params: { search: debounced, limit: 20 } }).then((r: any) => r.data),
    enabled: open,
  })
  const results: ContactLite[] = data?.items ?? []

  return (
    <div className="relative">
      <input
        className={inputCls}
        value={term}
        placeholder="Search contact or company…"
        onChange={e => { setTerm(e.target.value); setOpen(true); if (value) onSelect('', '') }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
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

// ── Line item totals ──────────────────────────────────────────────────────────

type LineItemForm = { description: string; quantity: string; unit_price: string; tax_rate_pct: number }
const EMPTY_ITEM: LineItemForm = { description: '', quantity: '1', unit_price: '0', tax_rate_pct: 21 }

function calcTotals(items: LineItemForm[]) {
  let subtotal = 0
  const vatByRate: Record<number, number> = {}
  for (const it of items) {
    if (!it.description.trim()) continue
    const excl = (parseInt(it.quantity) || 1) * Math.round((parseFloat(it.unit_price) || 0) * 100)
    const vat = Math.round(excl * it.tax_rate_pct / 100)
    subtotal += excl
    vatByRate[it.tax_rate_pct] = (vatByRate[it.tax_rate_pct] ?? 0) + vat
  }
  const totalVat = Object.values(vatByRate).reduce((a, b) => a + b, 0)
  return { subtotal, vatByRate, totalVat, total: subtotal + totalVat }
}

// Line item column grid: description wide, qty narrow, price medium, vat narrow, delete narrow
const LINE_GRID = '1fr 52px 90px 68px 20px'

// ── Add Invoice Modal ─────────────────────────────────────────────────────────

function AddInvoiceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const t = useT()
  const [contactId, setContactId] = useState('')
  const [contactName, setContactName] = useState('')
  const [items, setItems] = useState<LineItemForm[]>([{ ...EMPTY_ITEM }])
  const [currency, setCurrency] = useState('EUR')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('pending')
  const [error, setError] = useState('')

  const totals = calcTotals(items)

  const mutation = useMutation({
    mutationFn: () => api.post('/billing/invoices', {
      contact_id: contactId,
      line_items: items.filter(i => i.description.trim()).map(i => ({
        description: i.description.trim(),
        quantity: parseInt(i.quantity) || 1,
        unit_price_cents: Math.round((parseFloat(i.unit_price) || 0) * 100),
        tax_rate_pct: i.tax_rate_pct,
      })),
      currency,
      invoice_date: invoiceDate || null,
      due_date: dueDate || null,
      notes: notes.trim() || null,
      status,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created')
      onClose()
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to create invoice'),
  })

  function setItem(idx: number, patch: Partial<LineItemForm>) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactId) { setError('Select a contact'); return }
    if (!items.some(i => i.description.trim())) { setError('Add at least one line item'); return }
    setError(''); mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">New Invoice</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          <div>
            <label className={labelCls}>Contact / Company *</label>
            <ContactPicker value={contactId} displayName={contactName}
              onSelect={(id, name) => { setContactId(id); setContactName(name) }} />
          </div>

          {/* Line items — CSS grid so headers align with inputs */}
          <div>
            <label className={labelCls}>Line items</label>
            {/* Header row */}
            <div className="grid gap-2 mb-1.5 px-0.5" style={{ gridTemplateColumns: LINE_GRID }}>
              <span className="text-xs text-slate-400">Description</span>
              <span className="text-xs text-slate-400 text-center">Qty</span>
              <span className="text-xs text-slate-400 text-right">Price excl.</span>
              <span className="text-xs text-slate-400 text-center">VAT %</span>
              <span />
            </div>
            <div className="flex flex-col gap-1.5">
              {items.map((it, idx) => (
                <div key={idx} className="grid gap-2 items-center" style={{ gridTemplateColumns: LINE_GRID }}>
                  <input className={inputCls} value={it.description}
                    placeholder="Service or product description"
                    onChange={e => setItem(idx, { description: e.target.value })} />
                  <input className={`${inputCls} text-center`} type="number" min={1} value={it.quantity}
                    onChange={e => setItem(idx, { quantity: e.target.value })} />
                  <input className={`${inputCls} text-right`} type="number" step="0.01" value={it.unit_price}
                    placeholder="0.00" onChange={e => setItem(idx, { unit_price: e.target.value })} />
                  <select className={inputCls} value={it.tax_rate_pct}
                    onChange={e => setItem(idx, { tax_rate_pct: parseInt(e.target.value) })}>
                    {VAT_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                  <button type="button"
                    onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                    className={`p-1 text-slate-300 hover:text-red-500 rounded transition-colors ${items.length === 1 ? 'invisible' : ''}`}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80">
              <Plus size={13} /> Add line
            </button>

            {/* Live totals */}
            {totals.subtotal > 0 && (
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-sm flex flex-col gap-1">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal excl. VAT</span>
                  <span>{fmtCents(totals.subtotal)}</span>
                </div>
                {Object.entries(totals.vatByRate).filter(([, v]) => v > 0).map(([rate, vat]) => (
                  <div key={rate} className="flex justify-between text-slate-500">
                    <span>VAT {rate}%</span><span>{fmtCents(vat as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200 mt-0.5">
                  <span>Total incl. VAT</span><span>{fmtCents(totals.total)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Invoice date</label>
              <input className={inputCls} type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input className={inputCls} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
                {ALL_STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{t((`invoice_${o.value}`) as any) ?? o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Payment info / Notes</label>
            <textarea className={`${inputCls} min-h-[72px] resize-y`} value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="E.g. IBAN NL12 BANK 0123 4567 89. Payment within 30 days." />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={mutation.isPending}
              className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
              {mutation.isPending ? 'Saving…' : 'Create invoice'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => api.delete('/billing/invoices/bulk', { data: { ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(`${ids.length} invoice${ids.length === 1 ? '' : 's'} deleted`)
      onClose()
    },
    onError: () => toast.error('Failed to delete invoices'),
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Delete invoices</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Delete <span className="font-semibold text-slate-900">{ids.length}</span> invoice{ids.length === 1 ? '' : 's'}? This cannot be undone.
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

// ── Import modal ──────────────────────────────────────────────────────────────

interface ImportError { row: number; reason: string }
interface ImportResult { imported: number; skipped: number; errors: ImportError[] }

function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const mutation = useMutation({
    mutationFn: async (f: File) => {
      const form = new FormData()
      form.append('file', f)
      const res = await api.post('/billing/invoices/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      return res.data as ImportResult
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      setResult(data)
      if (data.imported > 0) toast.success(`${data.imported} invoice${data.imported === 1 ? '' : 's'} imported`)
      if (data.skipped > 0) toast.warning(`${data.skipped} row${data.skipped === 1 ? '' : 's'} skipped`)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Import failed'),
  })

  function downloadTemplate() {
    api.get('/billing/invoices/import-template', { responseType: 'blob' }).then((res: any) =>
      downloadBlob(res.data, 'invoice_import_template.csv', 'text/csv'))
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Import Invoices</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {!result ? (
            <>
              <p className="text-sm text-slate-600">
                Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file. Contacts matched by email, then by name.
              </p>
              <button type="button" onClick={downloadTemplate}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-yippie hover:opacity-80 self-start">
                <Download size={13} /> Download CSV template
              </button>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-yippie/50 transition-colors"
                onClick={() => fileRef.current?.click()}>
                <Upload size={24} className="text-slate-300 mx-auto mb-2" />
                {file
                  ? <p className="text-sm font-medium text-slate-700">{file.name}</p>
                  : <p className="text-sm text-slate-400">Click to choose a file</p>}
                <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="flex gap-3">
                <button type="button" disabled={!file || mutation.isPending} onClick={() => file && mutation.mutate(file)}
                  className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
                  {mutation.isPending ? 'Importing…' : 'Import'}
                </button>
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                  <p className="text-xs text-slate-500 mt-0.5">imported</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">{result.skipped}</p>
                  <p className="text-xs text-slate-500 mt-0.5">skipped</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50 p-3 flex flex-col gap-1.5">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Row {e.row}:</span> {e.reason}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90">Done</button>
                <button type="button" onClick={() => { setResult(null); setFile(null) }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Import another</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Inline status cell ────────────────────────────────────────────────────────

function StatusCell({ invoice, onPatch }: { invoice: Invoice; onPatch: (id: string, status: string) => void }) {
  return (
    <div className="relative inline-flex items-center">
      <span className={`inline-flex items-center pl-2 pr-5 py-0.5 rounded-full text-xs font-semibold pointer-events-none ${STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft}`}>
        {/* label rendered by select below */}
      </span>
      <select
        value={invoice.status}
        onChange={e => { e.stopPropagation(); onPatch(invoice.id, e.target.value) }}
        onClick={e => e.stopPropagation()}
        className={`absolute inset-0 opacity-0 cursor-pointer w-full`}
        style={{ appearance: 'none' }}
      >
        {ALL_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {/* Visible badge with chevron */}
      <span className={`absolute inset-0 flex items-center gap-1 pl-2 pr-1.5 rounded-full text-xs font-semibold pointer-events-none ${STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft}`}>
        {ALL_STATUS_OPTIONS.find(o => o.value === invoice.status)?.label ?? invoice.status}
        <ChevronDown size={10} className="opacity-60 shrink-0" />
      </span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InvoiceList() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rightClickId, setRightClickId] = useState<string | null>(null)
  const [peekId, setPeekId] = useState<string | null>(null)

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then((r: any) => r.data),
  })

  const patchStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/billing/invoices/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
    onError: () => toast.error('Status update failed'),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return invoices ?? []
    return (invoices ?? []).filter((inv: any) =>
      inv.invoice_number.toLowerCase().includes(term) ||
      (inv.contact_name ?? '').toLowerCase().includes(term)
    )
  }, [invoices, search])

  const filteredIds = filtered.map((inv: any) => inv.id)
  const selection = useSelection(filteredIds)
  const ctx = useContextMenu()

  // ── Export CSV/XLSX ───────────────────────────────────────────────────────

  async function exportData(format: 'csv' | 'xlsx' = 'csv', ids?: string[]) {
    const params: Record<string, string> = { format }
    const exportIds = ids ?? (selection.count ? [...selection.sel] : undefined)
    if (exportIds) params.ids = exportIds.join(',')
    try {
      const res = await api.get('/billing/invoices/export', { params, responseType: 'blob' })
      const type = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
      downloadBlob(res.data, `invoices.${format}`, type)
    } catch { toast.error('Export failed') }
  }

  // ── Export PDF (single or multi) ──────────────────────────────────────────

  async function downloadPdf(id: string, invoiceNumber: string) {
    try {
      const res = await api.get(`/billing/invoices/${id}/pdf`, { responseType: 'blob' })
      downloadBlob(res.data, `invoice-${invoiceNumber}.pdf`, 'application/pdf')
    } catch { toast.error(`PDF failed for ${invoiceNumber}`) }
  }

  async function bulkDownloadPdf() {
    const ids = selection.count ? [...selection.sel] : filtered.map((i: any) => i.id)
    if (ids.length > 5) toast.info(`Downloading ${ids.length} PDFs…`)
    for (const id of ids) {
      const inv = (invoices ?? []).find((i: any) => i.id === id)
      await downloadPdf(id, inv?.invoice_number ?? id)
      if (ids.length > 1) await new Promise(r => setTimeout(r, 120))
    }
  }

  // ── Bulk send ─────────────────────────────────────────────────────────────

  async function bulkSend() {
    const ids = [...selection.sel]
    let sent = 0, failed = 0
    for (const id of ids) {
      try { await api.post(`/billing/invoices/${id}/send`); sent++ }
      catch { failed++ }
    }
    qc.invalidateQueries({ queryKey: ['invoices'] })
    if (sent) toast.success(`${sent} invoice${sent > 1 ? 's' : ''} sent`)
    if (failed) toast.error(`${failed} failed. Contact may have no email.`)
    selection.clear()
  }

  async function sendSingle(id: string) {
    try {
      const r = await api.post(`/billing/invoices/${id}/send`) as any
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(`Invoice sent to ${r.data.email}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? 'Send failed')
    }
  }

  const [showExportMenu, setShowExportMenu] = useState(false)

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(v => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
              <Download size={15} strokeWidth={2.5} /> Export <ChevronDown size={13} className="opacity-60" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl border border-slate-200 shadow-lg z-20 py-1 overflow-hidden">
                  <button
                    onClick={() => { exportData('csv'); setShowExportMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <Download size={14} className="text-slate-400" /> CSV
                  </button>
                  <button
                    onClick={() => { bulkDownloadPdf(); setShowExportMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                    <FileDown size={14} className="text-slate-400" /> PDF
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg transition-colors">
            <Upload size={15} strokeWidth={2.5} /> Import
          </button>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">
            <Plus size={15} strokeWidth={2.5} /> New Invoice
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by invoice # or contact…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      {/* ── Bulk bar ── */}
      <BulkBar
        count={selection.count}
        onClear={selection.clear}
        actions={[
          { label: 'Export PDF', icon: <FileDown size={13} />, onClick: bulkDownloadPdf },
          { label: 'Export CSV', icon: <Download size={13} />, onClick: () => exportData('csv') },
          { label: 'Send', icon: <Mail size={13} />, onClick: bulkSend },
          { label: 'Delete', icon: <Trash2 size={13} />, danger: true, onClick: () => setConfirmDelete(true) },
        ]}
      />

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading && <p className="text-sm text-slate-400 p-6">Loading…</p>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={selection.all} indeterminate={selection.some}
                    onChange={selection.toggleAll} ariaLabel="Select all" />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left w-28">Invoice #</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left w-40">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right w-28">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left w-28">Due date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv: any) => (
                <tr
                  key={inv.id}
                  className="transition-colors cursor-pointer hover:bg-slate-50/80"
                  style={{ background: selection.has(inv.id) ? 'rgba(91,164,245,0.08)' : undefined }}
                  onClick={e => {
                    if ((e.target as HTMLElement).closest('td:first-child')) return
                    if ((e.target as HTMLElement).closest('select')) return
                    setPeekId(inv.id)
                  }}
                  onContextMenu={e => ctx.open(e, [
                    { header: inv.invoice_number },
                    {
                      label: 'Export PDF', icon: <FileDown size={14} />,
                      onClick: () => downloadPdf(inv.id, inv.invoice_number),
                    },
                    {
                      label: 'Export CSV', icon: <Download size={14} />,
                      onClick: () => exportData('csv', [inv.id]),
                    },
                    {
                      label: 'Send by email', icon: <Mail size={14} />,
                      onClick: () => sendSingle(inv.id),
                    },
                    {
                      label: 'Delete', icon: <Trash2 size={14} />, danger: true,
                      onClick: () => { setRightClickId(inv.id); setConfirmDelete(true) },
                    },
                  ])}
                >
                  <td className="px-4 py-3">
                    <Checkbox checked={selection.has(inv.id)} onChange={e => selection.toggle(inv.id, e)}
                      ariaLabel={`Select ${inv.invoice_number}`} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 font-mono">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{inv.contact_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusCell invoice={inv} onPatch={(id, status) => patchStatusMutation.mutate({ id, status })} />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right">
                    {fmtCents(inv.total_cents, inv.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <Receipt size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">
              {search ? 'No matching invoices' : 'No invoices yet'}
            </p>
          </div>
        )}
      </div>

      <ContextMenu state={ctx.state} onClose={ctx.close} />
      {showAdd && <AddInvoiceModal onClose={() => setShowAdd(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {confirmDelete && (
        <DeleteModal
          ids={rightClickId ? [rightClickId] : [...selection.sel]}
          onClose={() => { setConfirmDelete(false); setRightClickId(null); selection.clear() }}
        />
      )}
      {peekId && <InvoicePeek invoiceId={peekId} onClose={() => setPeekId(null)} />}
    </div>
  )
}
