import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8', sent: '#2563eb', paid: '#16a34a', overdue: '#dc2626', void: '#6b7280',
}

export default function InvoiceList() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get('/billing/invoices').then(r => r.data),
  })

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Invoices</h1>
      {isLoading && <p>Loading...</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
            <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>Invoice #</th>
            <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>Status</th>
            <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>Total</th>
            <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 600 }}>Due date</th>
          </tr>
        </thead>
        <tbody>
          {invoices?.map((inv: any) => (
            <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px 12px', fontWeight: 500 }}>{inv.invoice_number}</td>
              <td style={{ padding: '10px 12px' }}>
                <span style={{
                  padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                  background: STATUS_COLOR[inv.status] + '20', color: STATUS_COLOR[inv.status],
                }}>
                  {inv.status}
                </span>
              </td>
              <td style={{ padding: '10px 12px' }}>
                {(inv.total_cents / 100).toFixed(2)} {inv.currency}
              </td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>
                {inv.due_date ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
