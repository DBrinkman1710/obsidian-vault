import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

interface Contact {
  id: string
  full_name: string
  email: string | null
  company: string | null
  phone: string | null
  created_at: string
}

export default function ContactList() {
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => api.get<{ items: Contact[]; total: number }>('/contacts', { params: { search: search || undefined } }).then(r => r.data),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contacts</h1>
        <Link to="/contacts/new" style={{
          padding: '8px 16px', background: '#2563eb', color: '#fff',
          borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600,
        }}>+ New Contact</Link>
      </div>

      <input
        placeholder="Search by name, email, or company..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', maxWidth: 400, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', marginBottom: 20, fontSize: 14 }}
      />

      {isLoading && <p>Loading...</p>}
      {data && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Name</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Email</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Company</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: '#475569' }}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 12px' }}>
                  <Link to={`/contacts/${c.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                    {c.full_name}
                  </Link>
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.email ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.company ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && <p style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>{data.total} total</p>}
    </div>
  )
}
