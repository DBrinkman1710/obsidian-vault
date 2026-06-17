import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt, Plus, Search, X, Trash2, Download, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'

// UI status labels mapped onto the backend InvoiceStatus enum values.
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
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

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', received: 'Received', not_sent: 'Not Sent',
}

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

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 mb-1.5'

function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s.charAt(0).toUpperCase() + s.slice(1)
}

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// ---- Contact typeahead -----------------------------------------------------

function ContactPicker({
  value, displayName, onSelect,
}: { value: string; displayName: string; onSelect: (id: string, name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState(displayName)
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(t)
  }, [term])

  const { data } = useQuery({
    queryKey: ['contact-search', debounced],
    queryFn: () => api.get('/contacts', { params: { search: debounced, limit: 20 } }).then(r => r.data),
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
            <button
              key={c.id}
              type="button"
              onMouseDown={() => { onSelect(c.id, c.full_name); setTerm(c.full_name); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">{c.full_name}</span>
              {c.email && <span className="text-slate-400 ml-2">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Add Invoice modal -----------------------------------------------------

type LineItemForm = { description: string; quantity: string; unit_price: string }
const EMPTY_ITEM: LineItemForm = { description: '', quantity: '1', unit_price: '0' }

function AddInvoiceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [contactId, setContactId] = useState('')
  const [contactName, setContactName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<LineItemForm[]>([{ ...EMPTY_ITEM }])
  const [tax, setTax] = useState('0')
  const [currency, setCurrency] = useState('EUR')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState('pending')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        contact_id: contactId,
        description: description.trim() || null,
        line_items: items
          .filter(i => i.description.trim())
          .map(i => ({
            description: i.description.trim(),
            quantity: parseInt(i.quantity) || 1,
            unit_price_cents: Math.round((parseFloat(i.unit_price) || 0) * 100),
          })),
        tax_cents: Math.round((parseFloat(tax) || 0) * 100),
        currency,
        due_date: dueDate || null,
        status,
      }
      return api.post('/billing/invoices', payload)
    },
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
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">New Invoice</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Contact / Company *</label>
            <ContactPicker
              value={contactId}
              displayName={contactName}
              onSelect={(id, name) => { setContactId(id); setContactName(name) }}
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional summary" />
          </div>
          <div>
            <label className={labelCls}>Line items</label>
            <div className="flex flex-col gap-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input className={`${inputCls} flex-1`} value={it.description} placeholder="Description"
                    onChange={e => setItem(idx, { description: e.target.value })} />
                  <input className={`${inputCls} w-16`} type="number" min={1} value={it.quantity} placeholder="Qty"
                    onChange={e => setItem(idx, { quantity: e.target.value })} />
                  <input className={`${inputCls} w-24`} type="number" step="0.01" value={it.unit_price} placeholder="Price"
                    onChange={e => setItem(idx, { unit_price: e.target.value })} />
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded shrink-0"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setItems(prev => [...prev, { ...EMPTY_ITEM }])}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-yippie hover:opacity-80">
              <Plus size={13} /> Add line item
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tax</label>
              <input className={inputCls} type="number" step="0.01" value={tax} onChange={e => setTax(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input className={inputCls} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={mutation.isPending}
              className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
              {mutation.isPending ? 'Saving…' : 'Create invoice'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---- Delete confirm modal --------------------------------------------------

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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Delete invoices</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Delete <span className="font-semibold text-slate-900">{ids.length}</span> invoice{ids.length === 1 ? '' : 's'}? This cannot be undone.
          </p>
          <div className="flex gap-3 pt-1">
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors">
              {mutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Page ------------------------------------------------------------------

export default function InvoiceList() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then(r => r.data),
  })

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return invoices ?? []
    return (invoices ?? []).filter(inv =>
      inv.invoice_number.toLowerCase().includes(term) ||
      (inv.contact_name ?? '').toLowerCase().includes(term)
    )
  }, [invoices, search])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allSelected = filtered.length > 0 && filtered.every(inv => selected.has(inv.id))
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(filtered.map(inv => inv.id)))
  }

  async function exportInvoices(format: 'csv' | 'xlsx') {
    setExportOpen(false)
    const params: Record<string, string> = { format }
    if (selected.size) params.ids = [...selected].join(',')
    try {
      const res = await api.get('/billing/invoices/export', { params, responseType: 'blob' })
      const type = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv'
      downloadBlob(res.data, `invoices.${format}`, type)
    } catch {
      toast.error('Export failed')
    }
  }

  const selectedIds = [...selected]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <button onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
          <Plus size={15} /> New Invoice
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-4 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by invoice # or contact…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <span className="text-sm font-medium text-slate-600">{selected.size} selected</span>
          <button onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <Trash2 size={13} /> Delete
          </button>
          <div className="relative">
            <button onClick={() => setExportOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
              <Download size={13} /> Export <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="absolute z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                <button onClick={() => exportInvoices('csv')} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-50">CSV</button>
                <button onClick={() => exportInvoices('xlsx')} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-50">XLSX</button>
              </div>
            )}
          </div>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Clear</button>
        </div>
      )}

      {selected.size === 0 && (
        <div className="flex justify-end mb-4">
          <div className="relative">
            <button onClick={() => setExportOpen(o => !o)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
              <Download size={13} /> Export all <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 z-10 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                <button onClick={() => exportInvoices('csv')} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-50">CSV</button>
                <button onClick={() => exportInvoices('xlsx')} className="block w-full text-left px-4 py-2 text-xs hover:bg-slate-50">XLSX</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading && <p className="text-sm text-slate-400 p-6">Loading…</p>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-slate-300" />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Invoice #</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Contact</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Due date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{inv.contact_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft}`}>
                      {statusLabel(inv.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{(inv.total_cents / 100).toFixed(2)} {inv.currency}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{inv.due_date ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <Receipt size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">{search ? 'No matching invoices' : 'No invoices yet'}</p>
          </div>
        )}
      </div>

      {showAdd && <AddInvoiceModal onClose={() => setShowAdd(false)} />}
      {confirmDelete && <DeleteModal ids={selectedIds} onClose={() => { setConfirmDelete(false); setSelected(new Set()) }} />}
    </div>
  )
}
