import { useQuery } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { api } from '../../../api/client'

const STATUS_STYLES: Record<string, string> = {
  draft:   'bg-slate-100 text-slate-600',
  sent:    'bg-blue-100 text-blue-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void:    'bg-slate-100 text-slate-500',
}

export default function InvoiceList() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then(r => r.data),
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Invoices</h1>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading && <p className="text-sm text-slate-400 p-6">Loading…</p>}
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Invoice #</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Total</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Due date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices?.map((inv: any) => (
              <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{inv.invoice_number}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {(inv.total_cents / 100).toFixed(2)} {inv.currency}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{inv.due_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && (!invoices || invoices.length === 0) && (
          <div className="py-12 text-center">
            <Receipt size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">No invoices yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
