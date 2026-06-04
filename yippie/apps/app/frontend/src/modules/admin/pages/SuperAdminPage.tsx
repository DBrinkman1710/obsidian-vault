import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Users, X, Building2 } from 'lucide-react'
import { api } from '../../../api/client'

const ALL_MODULES = ['contacts', 'tickets', 'billing', 'activity', 'inbox', 'chat']

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

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function ModuleToggle({ mod, active, onClick }: { mod: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
    >
      {mod}
    </button>
  )
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [error, setError] = useState('')

  const set = (field: keyof CreateForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setForm(prev => ({ ...prev, [field]: val, ...(field === 'name' ? { slug: slugify(val) } : {}) }))
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to create client'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim() || !form.admin_email.trim() || !form.admin_password.trim()) {
      setError('All fields are required'); return
    }
    setError('')
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Create client environment</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Company name *</label>
              <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Acme BV" autoFocus /></div>
            <div><label className={labelCls}>Slug *</label>
              <input className={inputCls} value={form.slug} onChange={set('slug')} placeholder="acme-bv" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Admin email *</label>
              <input className={inputCls} type="email" value={form.admin_email} onChange={set('admin_email')} placeholder="admin@acme.nl" /></div>
            <div><label className={labelCls}>Admin password *</label>
              <input className={inputCls} type="password" value={form.admin_password} onChange={set('admin_password')} placeholder="••••••••" /></div>
          </div>
          <div>
            <label className={labelCls}>Brand color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.primary_color}
                onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              />
              <span className="text-sm text-slate-500 font-mono">{form.primary_color}</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Enabled modules</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_MODULES.map(mod => (
                <ModuleToggle key={mod} mod={mod} active={form.enabled_modules.includes(mod)} onClick={() => toggleModule(mod)} />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
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
  const toggle = (mod: string) => setModules(prev => prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod])
  const mutation = useMutation({
    mutationFn: (enabled_modules: string[]) => api.patch(`/admin/tenants/${tenant.id}`, { enabled_modules }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: () => setError('Failed to update modules'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit modules</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {ALL_MODULES.map(mod => <ModuleToggle key={mod} mod={mod} active={modules.includes(mod)} onClick={() => toggle(mod)} />)}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={() => mutation.mutate(modules)} disabled={mutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
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

  const ROLE_STYLES: Record<string, string> = {
    superadmin: 'bg-amber-100 text-amber-800',
    admin: 'bg-blue-100 text-blue-700',
    agent: 'bg-slate-100 text-slate-600',
    viewer: 'bg-slate-100 text-slate-500',
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Users</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {isLoading && <p className="text-sm text-slate-400 p-6">Loading…</p>}
          {data && data.length === 0 && <p className="text-sm text-slate-400 p-6">No users yet.</p>}
          {data && data.length > 0 && (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{u.full_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLES[u.role] ?? ROLE_STYLES.viewer}`}>{u.role}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Client environments</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage all tenant environments</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} />
          New client
        </button>
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && (!tenants || tenants.length === 0) && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No clients yet. Create the first one.</p>
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Client</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Modules</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Users</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenants.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.primary_color }} />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                        <div className="text-xs text-slate-400">{t.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {t.enabled_modules.map(m => (
                        <span key={m} className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setViewingUsers(t)}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      <Users size={13} />
                      {t.user_count} {t.user_count === 1 ? 'user' : 'users'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(t.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingTenant(t)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Edit modules
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
      {editingTenant && <EditModulesModal tenant={editingTenant} onClose={() => setEditingTenant(null)} />}
      {viewingUsers && <TenantUsersModal tenant={viewingUsers} onClose={() => setViewingUsers(null)} />}
    </div>
  )
}
