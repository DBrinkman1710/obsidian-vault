import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../api/client'

const ALL_MODULES = ['contacts', 'tickets', 'billing', 'activity', 'inbox', 'chat']

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
  fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4,
}

interface Tenant {
  id: string
  slug: string
  name: string
  enabled_modules: string[]
  primary_color: string
  logo_url: string | null
  user_count: number
  created_at: string
}

interface TenantUser {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

interface CreateForm {
  name: string
  slug: string
  admin_email: string
  admin_password: string
  primary_color: string
  enabled_modules: string[]
}

const EMPTY_FORM: CreateForm = {
  name: '', slug: '', admin_email: '', admin_password: '',
  primary_color: '#5BB8E8', enabled_modules: [...ALL_MODULES],
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [error, setError] = useState('')

  const set = (field: keyof CreateForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setForm(prev => ({
        ...prev,
        [field]: val,
        ...(field === 'name' ? { slug: slugify(val) } : {}),
      }))
    }

  const toggleModule = (mod: string) =>
    setForm(prev => ({
      ...prev,
      enabled_modules: prev.enabled_modules.includes(mod)
        ? prev.enabled_modules.filter(m => m !== mod)
        : [...prev.enabled_modules, mod],
    }))

  const mutation = useMutation({
    mutationFn: (data: CreateForm) => api.post('/admin/tenants', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      onClose()
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to create client'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim() || !form.admin_email.trim() || !form.admin_password.trim()) {
      setError('All fields are required')
      return
    }
    setError('')
    mutation.mutate(form)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: 28,
        width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Create client environment</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Company name *</label>
              <input style={inputStyle} value={form.name} onChange={set('name')} placeholder="Acme BV" autoFocus />
            </div>
            <div>
              <label style={labelStyle}>Slug (URL identifier) *</label>
              <input style={inputStyle} value={form.slug} onChange={set('slug')} placeholder="acme-bv" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Admin email *</label>
              <input style={inputStyle} type="email" value={form.admin_email} onChange={set('admin_email')} placeholder="admin@acme.nl" />
            </div>
            <div>
              <label style={labelStyle}>Admin password *</label>
              <input style={inputStyle} type="password" value={form.admin_password} onChange={set('admin_password')} placeholder="••••••••" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Brand color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="color" value={form.primary_color}
                onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                style={{ width: 36, height: 36, borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', padding: 2 }}
              />
              <span style={{ fontSize: 13, color: '#64748b' }}>{form.primary_color}</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Enabled modules</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {ALL_MODULES.map(mod => (
                <button
                  key={mod} type="button"
                  onClick={() => toggleModule(mod)}
                  style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: form.enabled_modules.includes(mod) ? '#eff6ff' : '#f8fafc',
                    borderColor: form.enabled_modules.includes(mod) ? '#93c5fd' : '#e2e8f0',
                    color: form.enabled_modules.includes(mod) ? '#2563eb' : '#94a3b8',
                  }}
                >
                  {mod}
                </button>
              ))}
            </div>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
              background: '#fff', fontSize: 14, cursor: 'pointer', color: '#475569',
            }}>Cancel</button>
            <button type="submit" disabled={mutation.isPending} style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer', opacity: mutation.isPending ? 0.7 : 1,
            }}>
              {mutation.isPending ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditModulesModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient()
  const [modules, setModules] = useState<string[]>(tenant.enabled_modules)
  const [error, setError] = useState('')

  const toggle = (mod: string) =>
    setModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod])

  const mutation = useMutation({
    mutationFn: (enabled_modules: string[]) =>
      api.patch(`/admin/tenants/${tenant.id}`, { enabled_modules }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      onClose()
    },
    onError: () => setError('Failed to update modules'),
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: 28,
        width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Edit modules</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{tenant.name}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {ALL_MODULES.map(mod => (
            <button
              key={mod} type="button" onClick={() => toggle(mod)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                border: '1px solid', cursor: 'pointer',
                background: modules.includes(mod) ? '#eff6ff' : '#f8fafc',
                borderColor: modules.includes(mod) ? '#93c5fd' : '#e2e8f0',
                color: modules.includes(mod) ? '#2563eb' : '#94a3b8',
              }}
            >
              {mod}
            </button>
          ))}
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
            background: '#fff', fontSize: 14, cursor: 'pointer', color: '#475569',
          }}>Cancel</button>
          <button onClick={() => mutation.mutate(modules)} disabled={mutation.isPending} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none',
            background: '#2563eb', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: mutation.isPending ? 'not-allowed' : 'pointer', opacity: mutation.isPending ? 0.7 : 1,
          }}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TenantUsersModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const { data, isLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users', tenant.id],
    queryFn: () => api.get(`/admin/tenants/${tenant.id}/users`).then(r => r.data),
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <div style={{
        background: '#fff', borderRadius: 10, padding: 28,
        width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Users</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{tenant.name}</p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8',
          }}>×</button>
        </div>
        {isLoading && <p style={{ color: '#94a3b8' }}>Loading…</p>}
        {data && data.length === 0 && <p style={{ color: '#94a3b8', fontSize: 14 }}>No users yet.</p>}
        {data && data.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Name</th>
                <th style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Email</th>
                <th style={{ padding: '6px 8px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {data.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 8px', fontSize: 14 }}>{u.full_name}</td>
                  <td style={{ padding: '8px 8px', fontSize: 14, color: '#64748b' }}>{u.email}</td>
                  <td style={{ padding: '8px 8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: u.role === 'superadmin' ? '#fef3c7' : u.role === 'admin' ? '#eff6ff' : '#f1f5f9',
                      color: u.role === 'superadmin' ? '#92400e' : u.role === 'admin' ? '#1d4ed8' : '#475569',
                    }}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function SuperAdminPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [viewingUsers, setViewingUsers] = useState<Tenant | null>(null)

  const { data: tenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => api.get('/admin/tenants').then(r => r.data),
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Client environments</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>Manage all tenant environments</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '8px 16px', background: '#2563eb', color: '#fff',
            borderRadius: 6, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + New client
        </button>
      </div>

      {isLoading && <p style={{ color: '#94a3b8' }}>Loading…</p>}
      {tenants && tenants.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '48px 24px', background: '#f8fafc',
          borderRadius: 8, border: '1px dashed #e2e8f0',
        }}>
          <p style={{ color: '#94a3b8', fontSize: 15 }}>No clients yet. Create the first one.</p>
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Client</th>
              <th style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Modules</th>
              <th style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Users</th>
              <th style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#475569' }}>Created</th>
              <th style={{ padding: '8px 12px', fontSize: 12, fontWeight: 600, color: '#475569' }}></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                      background: t.primary_color,
                    }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.slug}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 12px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {t.enabled_modules.map(m => (
                      <span key={m} style={{
                        padding: '2px 6px', borderRadius: 999, fontSize: 11, fontWeight: 500,
                        background: '#eff6ff', color: '#2563eb',
                      }}>{m}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '12px 12px' }}>
                  <button
                    onClick={() => setViewingUsers(t)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, color: '#2563eb', fontWeight: 500, padding: 0,
                    }}
                  >
                    {t.user_count} {t.user_count === 1 ? 'user' : 'users'}
                  </button>
                </td>
                <td style={{ padding: '12px 12px', color: '#94a3b8', fontSize: 13 }}>
                  {new Date(t.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ padding: '12px 12px', textAlign: 'right' }}>
                  <button
                    onClick={() => setEditingTenant(t)}
                    style={{
                      padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#475569',
                    }}
                  >
                    Edit modules
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
      {editingTenant && <EditModulesModal tenant={editingTenant} onClose={() => setEditingTenant(null)} />}
      {viewingUsers && <TenantUsersModal tenant={viewingUsers} onClose={() => setViewingUsers(null)} />}
    </div>
  )
}
