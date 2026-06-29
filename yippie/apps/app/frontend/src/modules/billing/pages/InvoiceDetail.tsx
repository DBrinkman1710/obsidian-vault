import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Download, Mail, Bell, CreditCard, X, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'

// ── Types ────────────────────────────────────────────────────────────────────

interface VatBreakdown { rate_pct: number; subtotal_cents: number; vat_cents: number }
interface LineItem { description: string; quantity: number; unit_price_cents: number; tax_rate_pct: number }
interface Payment { id: string; amount_cents: number; currency: string; method: string; reference: string | null; paid_at: string }

interface Invoice {
  id: string
  invoice_number: string
  contact_id: string
  contact_name: string | null
  status: string
  line_items: LineItem[]
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  currency: string
  invoice_date: string | null
  due_date: string | null
  notes: string | null
  paid_at: string | null
  created_at: string
  vat_breakdown: VatBreakdown[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_OPTIONS = ['draft', 'pending', 'sent', 'received', 'paid', 'overdue', 'void', 'not_sent']

function fmtCents(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(cents / 100)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL')
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    draft: 'Draft', sent: 'Verstuurd', paid: 'Betaald', overdue: 'Verlopen',
    void: 'Vervallen', pending: 'In behandeling', received: 'Ontvangen', not_sent: 'Niet verstuurd',
  }
  return map[s] ?? s
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

// ── Record Payment Modal ──────────────────────────────────────────────────────

function RecordPaymentModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('bank_transfer')
  const [ref, setRef] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/payments`, {
      amount_cents: Math.round((parseFloat(amount) || 0) * 100),
      method,
      reference: ref || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] })
      toast.success('Betaling geregistreerd')
      onClose()
    },
    onError: (e: any) => setError(e.response?.data?.detail ?? 'Mislukt'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Betaling registreren</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Bedrag (€)</label>
            <input className={inputCls} type="number" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0,00" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Methode</label>
            <select className={inputCls} value={method} onChange={e => setMethod(e.target.value)}>
              <option value="bank_transfer">Bankoverschrijving</option>
              <option value="cash">Contant</option>
              <option value="card">Kaart</option>
              <option value="ideal">iDEAL</option>
              <option value="other">Overig</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Referentie (optioneel)</label>
            <input className={inputCls} value={ref} onChange={e => setRef(e.target.value)}
              placeholder="Transactie-ID, cheque nr…" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => {
                if (!amount || parseFloat(amount) <= 0) { setError('Voer een bedrag in'); return }
                setError('')
                mutation.mutate()
              }}
              disabled={mutation.isPending}
              className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Opslaan…' : 'Registreren'}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Annuleren
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showPayModal, setShowPayModal] = useState(false)
  const [editNotes, setEditNotes] = useState(false)
  const [notesVal, setNotesVal] = useState('')

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api.get(`/billing/invoices/${invoiceId}`).then((r: any) => r.data),
    enabled: !!invoiceId,
  })

  const { data: payments } = useQuery<Payment[]>({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: () => api.get(`/billing/invoices/${invoiceId}/payments`).then((r: any) => r.data),
    enabled: !!invoiceId,
  })

  const patchMutation = useMutation({
    mutationFn: (body: object) => api.patch(`/billing/invoices/${invoiceId}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', invoiceId] }),
    onError: () => toast.error('Update mislukt'),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/send`),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      toast.success(`Factuur verstuurd naar ${r.data.email}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Versturen mislukt'),
  })

  const remindMutation = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/remind`),
    onSuccess: (r: any) => toast.success(`Herinnering verstuurd naar ${r.data.email}`),
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Versturen mislukt'),
  })

  async function downloadPdf() {
    try {
      const res = await api.get(`/billing/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `factuur-${invoice?.invoice_number ?? invoiceId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF downloaden mislukt')
    }
  }

  if (isLoading) return <div className="p-8 text-sm text-slate-400">Laden…</div>
  if (!invoice) return <div className="p-8 text-sm text-slate-500">Factuur niet gevonden.</div>

  const currency = invoice.currency || 'EUR'
  const totalPaid = (payments ?? []).reduce((s: number, p: Payment) => s + p.amount_cents, 0)
  const outstanding = invoice.total_cents - totalPaid

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/billing')}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} /> Terug
        </button>
        <div className="flex items-center gap-2">
          <button onClick={downloadPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors">
            <Download size={14} /> PDF
          </button>
          <button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg transition-colors disabled:opacity-50">
            <Mail size={14} /> {sendMutation.isPending ? 'Versturen…' : 'Verstuur'}
          </button>
          {invoice.status === 'overdue' && (
            <button onClick={() => remindMutation.mutate()} disabled={remindMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors disabled:opacity-50">
              <Bell size={14} /> {remindMutation.isPending ? 'Versturen…' : 'Herinnering'}
            </button>
          )}
          <button onClick={() => setShowPayModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-yippie hover:opacity-90 text-white rounded-xl transition-opacity">
            <CreditCard size={14} /> Betaling
          </button>
        </div>
      </div>

      {/* ── Invoice card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Invoice meta header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Factuur</p>
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{invoice.invoice_number}</h1>
            <p className="text-sm text-slate-500 mt-1">{invoice.contact_name ?? '—'}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft}`}>
              {statusLabel(invoice.status)}
            </span>
            {/* Status picker */}
            <div className="relative">
              <select
                value={invoice.status}
                onChange={e => patchMutation.mutate({ status: e.target.value })}
                className="text-xs text-slate-500 border border-slate-200 rounded-lg px-2 py-1 appearance-none pr-6 focus:outline-none focus:ring-1 focus:ring-yippie/30 cursor-pointer"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Dates row */}
        <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Factuurdatum</p>
            <p className="text-slate-800">{fmtDate(invoice.invoice_date ?? invoice.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Vervaldatum</p>
            <p className="text-slate-800">{fmtDate(invoice.due_date)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Aangemaakt</p>
            <p className="text-slate-800">{fmtDate(invoice.created_at)}</p>
          </div>
        </div>

        {/* Line items table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Omschrijving</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Aantal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Prijs excl.</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">BTW %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrag excl.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(invoice.line_items ?? []).map((item: LineItem, i: number) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/50' : ''}>
                  <td className="px-6 py-3 text-sm text-slate-800">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{fmtCents(item.unit_price_cents, currency)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{item.tax_rate_pct ?? 21}%</td>
                  <td className="px-4 py-3 text-sm text-slate-800 font-medium text-right">
                    {fmtCents(item.quantity * item.unit_price_cents, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-6 py-5 border-t border-slate-100 flex justify-end">
          <div className="w-72 flex flex-col gap-1.5">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotaal excl. BTW</span>
              <span>{fmtCents(invoice.subtotal_cents, currency)}</span>
            </div>
            {(invoice.vat_breakdown ?? []).map((vb: VatBreakdown) => (
              <div key={vb.rate_pct} className="flex justify-between text-sm text-slate-600">
                <span>{vb.rate_pct > 0 ? `BTW ${vb.rate_pct}%` : 'BTW vrijgesteld (0%)'}</span>
                <span>{fmtCents(vb.vat_cents, currency)}</span>
              </div>
            ))}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200 mt-1">
              <span>Totaal incl. BTW</span>
              <span>{fmtCents(invoice.total_cents, currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="px-6 py-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Betalingsinformatie / Notities</p>
            {!editNotes && (
              <button onClick={() => { setNotesVal(invoice.notes ?? ''); setEditNotes(true) }}
                className="text-xs text-yippie hover:opacity-80 font-semibold">
                Bewerken
              </button>
            )}
          </div>
          {editNotes ? (
            <div className="flex flex-col gap-2">
              <textarea
                className={`${inputCls} min-h-[80px] resize-y`}
                value={notesVal}
                onChange={e => setNotesVal(e.target.value)}
                placeholder="Betalingstermijn, IBAN, opmerkingen…"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { patchMutation.mutate({ notes: notesVal }); setEditNotes(false) }}
                  className="px-3 py-1.5 text-xs font-semibold bg-yippie text-white rounded-lg hover:opacity-90">
                  Opslaan
                </button>
                <button onClick={() => setEditNotes(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                  Annuleren
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {invoice.notes || <span className="text-slate-400 italic">Geen notities</span>}
            </p>
          )}
        </div>
      </div>

      {/* ── Payment history ── */}
      {(payments ?? []).length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Betalingen</h2>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Methode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Referentie</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(payments ?? []).map((p: Payment) => (
                <tr key={p.id}>
                  <td className="px-6 py-3 text-sm text-slate-700">{fmtDate(p.paid_at)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{p.method.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{p.reference ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-green-700 text-right">{fmtCents(p.amount_cents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {outstanding > 0 && invoice.status !== 'paid' && (
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <span className="text-sm font-semibold text-amber-700">
                Openstaand: {fmtCents(outstanding, currency)}
              </span>
            </div>
          )}
        </div>
      )}

      {showPayModal && invoiceId && (
        <RecordPaymentModal invoiceId={invoiceId} onClose={() => setShowPayModal(false)} />
      )}
    </div>
  )
}
