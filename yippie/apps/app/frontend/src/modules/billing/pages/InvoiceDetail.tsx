import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Mail, Bell, CreditCard, ChevronDown, Lock, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useT } from '../../../hooks/useT'
import { fmtDate as libFmtDate } from '../../../lib/format'
import { CloseButton } from '../../../shell/CloseButton'

// ── Types ─────────────────────────────────────────────────────────────────────

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
  issued_at: string | null
  is_issued: boolean
  reverse_charge: boolean
  payment_terms: string | null
  credit_note_of_id: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const ISSUED_STATUS_OPTIONS = ['sent', 'received', 'paid', 'overdue']

function fmtCents(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-EU', { style: 'currency', currency }).format(cents / 100)
}

const fmtDate = libFmtDate

function statusLabel(s: string, t: (k: any) => string) {
  return t((`invoice_${s}`) as any) ?? (ALL_STATUS_OPTIONS.find(o => o.value === s)?.label ?? s)
}

const inputCls = 'input-base'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

// ── Record Payment Modal ──────────────────────────────────────────────────────

function RecordPaymentModal({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const t = useT()
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
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(t('billing_record_success'))
      onClose()
    },
    onError: (e: any) => setError(e.response?.data?.detail ?? 'Failed'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{t('billing_record_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>{t('billing_record_amount')}</label>
            <input className={inputCls} type="number" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <label className={labelCls}>{t('billing_record_method')}</label>
            <select className={inputCls} value={method} onChange={e => setMethod(e.target.value)}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="ideal">iDEAL</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t('billing_record_ref')}</label>
            <input className={inputCls} value={ref} onChange={e => setRef(e.target.value)}
              placeholder={t('billing_record_ref_ph')} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => {
                if (!amount || parseFloat(amount) <= 0) { setError(t('billing_record_error_amt')); return }
                setError(''); mutation.mutate()
              }}
              disabled={mutation.isPending}
              className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50">
              {mutation.isPending ? t('billing_record_saving') : t('billing_record_save')}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              {t('billing_record_cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── InvoicePeek — exported slide-over used by InvoiceList ─────────────────────

export function InvoicePeek({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const t = useT()
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Update failed'),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/send`),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(t('billing_toast_sent').replace('{email}', r.data.email))
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? t('billing_toast_send_fail')),
  })

  const creditMutation = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/credit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(t('billing_toast_credit'))
    },
    onError: (e: any) => toast.error(e.response?.data?.detail ?? 'Could not create credit note'),
  })

  const remindMutation = useMutation({
    mutationFn: () => api.post(`/billing/invoices/${invoiceId}/remind`),
    onSuccess: (r: any) => toast.success(t('billing_toast_reminded').replace('{email}', r.data.email)),
    onError: (e: any) => toast.error(e.response?.data?.detail ?? t('billing_toast_send_fail')),
  })

  async function downloadPdf() {
    try {
      const res = await api.get(`/billing/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      downloadBlob(res.data, `invoice-${invoice?.invoice_number ?? invoiceId}.pdf`, 'application/pdf')
    } catch {
      toast.error(t('billing_toast_pdf_fail'))
    }
  }

  const currency = invoice?.currency || 'EUR'
  const totalPaid = (payments ?? []).reduce((s: number, p: Payment) => s + p.amount_cents, 0)
  const outstanding = (invoice?.total_cents ?? 0) - totalPaid

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* ── Panel header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {isLoading
              ? <span className="text-sm text-slate-400">{t('billing_peek_loading')}</span>
              : <>
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {invoice?.invoice_number ?? <span className="italic font-sans text-slate-400">{t('billing_concept')}</span>}
                  </span>
                  {invoice && (
                    <div className="relative">
                      <select
                        value={invoice.status}
                        onChange={e => patchMutation.mutate({ status: e.target.value })}
                        className={`text-xs font-semibold pl-2 pr-5 py-0.5 rounded-full border-0 cursor-pointer appearance-none focus:outline-none ${STATUS_STYLES[invoice.status] ?? STATUS_STYLES.draft}`}
                      >
                        {ALL_STATUS_OPTIONS
                          .filter(o => !invoice.is_issued || ISSUED_STATUS_OPTIONS.includes(o.value) || o.value === invoice.status)
                          .map(o => (
                            <option key={o.value} value={o.value}>{statusLabel(o.value, t)}</option>
                          ))}
                      </select>
                      <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>
                  )}
                </>
            }
          </div>
          <div className="flex items-center gap-1.5">
            {invoice && (
              <>
                <button onClick={downloadPdf}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors">
                  <Download size={13} /> {t('billing_peek_pdf')}
                </button>
                <button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50">
                  <Mail size={13} /> {sendMutation.isPending ? t('billing_peek_sending') : t('billing_peek_send')}
                </button>
                {invoice.status === 'overdue' && (
                  <button onClick={() => remindMutation.mutate()} disabled={remindMutation.isPending}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition-colors disabled:opacity-50">
                    <Bell size={13} /> {remindMutation.isPending ? t('billing_peek_reminding') : t('billing_peek_remind')}
                  </button>
                )}
                {invoice.is_issued && !invoice.credit_note_of_id && (
                  <button onClick={() => {
                    if (confirm(t('billing_credit_confirm').replace('{number}', invoice.invoice_number))) creditMutation.mutate()
                  }} disabled={creditMutation.isPending}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50">
                    <RotateCcw size={13} /> {creditMutation.isPending ? t('billing_peek_crediting') : t('billing_peek_credit')}
                  </button>
                )}
                <button onClick={() => setShowPayModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-yippie hover:opacity-90 text-white rounded-lg transition-opacity">
                  <CreditCard size={13} /> {t('billing_peek_payment')}
                </button>
              </>
            )}
            <CloseButton onClick={onClose} className="ml-1" />
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && <p className="text-sm text-slate-400 p-6">{t('billing_peek_loading')}</p>}
          {!isLoading && !invoice && <p className="text-sm text-slate-500 p-6">{t('billing_peek_not_found')}</p>}

          {invoice && (
            <>
              {invoice.is_issued && (
                <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                  <Lock size={12} className="shrink-0" />
                  <span>
                    {t('billing_issued_notice').replace('{date}', fmtDate(invoice.issued_at) ?? '')}
                    {!invoice.credit_note_of_id && ` ${t('billing_issued_credit_hint')}`}
                  </span>
                </div>
              )}
              {invoice.reverse_charge && (
                <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
                  {t('billing_vat_reversed')} — VAT reverse charged to the recipient.
                </div>
              )}

              {/* Contact + dates */}
              <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-4 gap-4 text-sm">
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('billing_section_bill_to')}</p>
                  <p className="font-semibold text-slate-900">{invoice.contact_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('billing_section_inv_date')}</p>
                  <p className="text-slate-700">{fmtDate(invoice.invoice_date ?? invoice.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('billing_section_due_date')}</p>
                  <p className={`font-medium ${invoice.status === 'overdue' ? 'text-red-600' : 'text-slate-700'}`}>
                    {fmtDate(invoice.due_date)}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('billing_li_desc')}</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-14">{t('billing_li_qty')}</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">{t('billing_li_price_excl')}</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">{t('billing_li_vat')}</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">{t('billing_li_total_excl')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(invoice.line_items ?? []).map((item: LineItem, i: number) => (
                      <tr key={i} className={i % 2 === 1 ? 'bg-slate-50/40' : ''}>
                        <td className="px-6 py-3 text-slate-800">{item.description}</td>
                        <td className="px-3 py-3 text-slate-600 text-center">{item.quantity}</td>
                        <td className="px-3 py-3 text-slate-600 text-right">{fmtCents(item.unit_price_cents, currency)}</td>
                        <td className="px-3 py-3 text-slate-500 text-center">{item.tax_rate_pct ?? 21}%</td>
                        <td className="px-4 py-3 font-medium text-slate-800 text-right">
                          {fmtCents(item.quantity * item.unit_price_cents, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
                <div className="w-64 flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{t('billing_subtotal_excl')}</span>
                    <span>{fmtCents(invoice.subtotal_cents, currency)}</span>
                  </div>
                  {(invoice.vat_breakdown ?? []).map((vb: VatBreakdown) => (
                    <div key={vb.rate_pct} className="flex justify-between text-sm text-slate-600">
                      <span>{vb.rate_pct > 0 ? t('billing_vat_label').replace('{rate}', String(vb.rate_pct)) : (invoice.reverse_charge ? t('billing_vat_reversed') : t('billing_vat_exempt'))}</span>
                      <span>{fmtCents(vb.vat_cents, currency)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200 mt-0.5">
                    <span>{t('billing_total_incl')}</span>
                    <span>{fmtCents(invoice.total_cents, currency)}</span>
                  </div>
                  {outstanding > 0 && invoice.status !== 'paid' && totalPaid > 0 && (
                    <div className="flex justify-between text-sm font-semibold text-amber-700 pt-1">
                      <span>{t('billing_outstanding')}</span>
                      <span>{fmtCents(outstanding, currency)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="px-6 py-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('billing_notes_label')}</p>
                  {!editNotes && !invoice.is_issued && (
                    <button onClick={() => { setNotesVal(invoice.notes ?? ''); setEditNotes(true) }}
                      className="text-xs text-yippie hover:opacity-80 font-semibold">{t('billing_notes_edit')}</button>
                  )}
                </div>
                {editNotes ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      className={`${inputCls} min-h-[72px] resize-y`}
                      value={notesVal}
                      onChange={e => setNotesVal(e.target.value)}
                      placeholder={t('billing_notes_ph')}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { patchMutation.mutate({ notes: notesVal }); setEditNotes(false) }}
                        className="px-3 py-1.5 text-xs font-semibold bg-yippie text-white rounded-lg hover:opacity-90">{t('billing_notes_save')}</button>
                      <button onClick={() => setEditNotes(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">{t('billing_notes_cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">
                    {invoice.notes ?? <span className="text-slate-400 italic">{t('billing_notes_empty')}</span>}
                  </p>
                )}
              </div>

              {/* Payment history */}
              {(payments ?? []).length > 0 && (
                <div className="px-6 py-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('billing_payments_title')}</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 uppercase tracking-wide">
                        <th className="text-left pb-2">{t('billing_pay_col_date')}</th>
                        <th className="text-left pb-2">{t('billing_pay_col_method')}</th>
                        <th className="text-left pb-2">{t('billing_pay_col_ref')}</th>
                        <th className="text-right pb-2">{t('billing_pay_col_amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(payments ?? []).map((p: Payment) => (
                        <tr key={p.id}>
                          <td className="py-2 text-slate-700">{fmtDate(p.paid_at)}</td>
                          <td className="py-2 text-slate-600 capitalize">{p.method.replace('_', ' ')}</td>
                          <td className="py-2 text-slate-500">{p.reference ?? '—'}</td>
                          <td className="py-2 font-semibold text-green-700 text-right">{fmtCents(p.amount_cents, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showPayModal && <RecordPaymentModal invoiceId={invoiceId} onClose={() => setShowPayModal(false)} />}
    </>
  )
}

// ── Page wrapper for direct-URL access (/billing/invoices/:id) ────────────────

export default function InvoiceDetail() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  if (!invoiceId) return null
  return <InvoicePeek invoiceId={invoiceId} onClose={() => navigate('/billing')} />
}
