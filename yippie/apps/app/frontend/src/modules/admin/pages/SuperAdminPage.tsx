import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, X, Building2, UserPlus, ShieldCheck,
  ToggleLeft, ToggleRight, Rocket, FlaskConical, CheckSquare, Square,
} from 'lucide-react'
import { api } from '../../../api/client'
import { useTenantConfig } from '../../../App'

const ALL_MODULES = ['inbox', 'contacts', 'tickets', 'activity', 'billing', 'chat', 'ai']

const MODULE_LABELS: Record<string, string> = { ai: 'AI' }
const moduleLabel = (mod: string) => MODULE_LABELS[mod] ?? mod

type FilterStatus = 'all' | 'active' | 'demo' | 'inactive'

interface Tenant {
  id: string
  slug: string
  name: string
  enabled_modules: string[]
  primary_color: string
  logo_url: string | null
  is_active: boolean
  is_demo: boolean
  go_live_at: string | null
  inbound_email: string | null
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
  is_demo: boolean
}

const EMPTY_FORM: CreateForm = {
  name: '', slug: '', admin_email: '', admin_password: '',
  primary_color: '#5BB8E8', enabled_modules: [...ALL_MODULES], is_demo: false,
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function statusOf(t: Tenant): 'active' | 'demo' | 'inactive' {
  if (!t.is_active) return 'inactive'
  if (t.is_demo) return 'demo'
  return 'active'
}

const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  demo: 'bg-amber-100 text-amber-700',
  inactive: 'bg-slate-100 text-slate-400',
}

function ModuleToggle({ mod, active, onClick }: { mod: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
    >
      {moduleLabel(mod)}
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
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.is_demo}
              onChange={e => setForm(p => ({ ...p, is_demo: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-sm text-slate-700 font-medium">Start as demo environment</span>
          </label>
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

function AddAdminModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ email: '', password: '', full_name: 'Admin' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post(`/admin/tenants/${tenant.id}/users`, form).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      qc.invalidateQueries({ queryKey: ['tenant-users', tenant.id] })
      onClose()
    },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to add admin'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.password.trim()) { setError('Email and password required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add admin</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Full name</label>
            <input className={inputCls} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Admin" />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="admin@company.nl" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Password *</label>
            <input className={inputCls} type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? 'Adding…' : 'Add admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TenantUsersModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [showAddAdmin, setShowAddAdmin] = useState(false)
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
    <>
      {showAddAdmin && <AddAdminModal tenant={tenant} onClose={() => setShowAddAdmin(false)} />}
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Users</h2>
              <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddAdmin(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <UserPlus size={12} />
                Add admin
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>
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
    </>
  )
}

function PromoteSuperadminPanel() {
  const [form, setForm] = useState({ target_email: '', current_password: '' })
  const [result, setResult] = useState<{ email: string; role: string } | null>(null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/admin/promote-superadmin', form).then(r => r.data),
    onSuccess: (data) => { setResult(data); setForm({ target_email: '', current_password: '' }) },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to promote'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.target_email.trim() || !form.current_password.trim()) { setError('All fields required'); return }
    setError('')
    setResult(null)
    mutation.mutate()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={18} className="text-amber-500" />
        <h2 className="text-base font-bold text-slate-900">Promote to superadmin</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">Requires your own password to confirm.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
        <div>
          <label className={labelCls}>Target email</label>
          <input className={inputCls} type="email" value={form.target_email}
            onChange={e => setForm(p => ({ ...p, target_email: e.target.value }))}
            placeholder="user@company.nl"
          />
        </div>
        <div>
          <label className={labelCls}>Your password</label>
          <input className={inputCls} type="password" value={form.current_password}
            onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))}
            placeholder="Confirm with your password"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        {result && (
          <p className="text-sm text-emerald-600 font-medium">
            ✓ {result.email} is now <strong>{result.role}</strong>
          </p>
        )}
        <div className="pt-1">
          <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
            {mutation.isPending ? 'Promoting…' : 'Promote to superadmin'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ResendDiagnosticPanel() {
  const [result, setResult] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.get('/admin/resend-check').then(r => r.data),
    onSuccess: (data) => { setResult(data); setOpen(true) },
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-slate-400" />
          <h2 className="text-base font-bold text-slate-900">Resend API diagnostic</h2>
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {mutation.isPending ? 'Checking…' : 'Run check'}
        </button>
      </div>
      <p className="text-sm text-slate-500">Calls the Resend receiving API and shows the raw response — use this to verify the API key has receive permissions and to see exactly what fields are returned.</p>

      {open && result && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Raw response</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
          </div>
          <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 overflow-auto max-h-96 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function SuperAdminPage() {
  const qc = useQueryClient()
  const config = useTenantConfig()
  const [showCreate, setShowCreate] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [viewingUsers, setViewingUsers] = useState<Tenant | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const { data: allTenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => api.get('/admin/tenants').then(r => r.data),
  })

  // Hide own environment
  const tenants = (allTenants ?? []).filter(t => t.id !== config?.tenant_id)

  const counts = {
    all: tenants.length,
    active: tenants.filter(t => statusOf(t) === 'active').length,
    demo: tenants.filter(t => statusOf(t) === 'demo').length,
    inactive: tenants.filter(t => statusOf(t) === 'inactive').length,
  }

  const visible = filter === 'all' ? tenants : tenants.filter(t => statusOf(t) === filter)

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/tenants/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  const toggleDemoMutation = useMutation({
    mutationFn: ({ id, is_demo }: { id: string; is_demo: boolean }) =>
      api.patch(`/admin/tenants/${id}`, { is_demo }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  const goLiveMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/tenants/${id}`, { is_demo: false, go_live_at: new Date().toISOString() }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  const bulkMutation = useMutation({
    mutationFn: async (patch: { is_active?: boolean; is_demo?: boolean }) => {
      await Promise.all([...selectedIds].map(id => api.patch(`/admin/tenants/${id}`, patch)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      setSelectedIds(new Set())
    },
  })

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === visible.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visible.map(t => t.id)))
    }
  }

  const allSelected = visible.length > 0 && selectedIds.size === visible.length
  const someSelected = selectedIds.size > 0

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'demo', label: 'Demo' },
    { key: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
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

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 -mt-4">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setSelectedIds(new Set()) }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
              filter === key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && visible.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {filter === 'all' ? 'No clients yet. Create the first one.' : `No ${filter} clients.`}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Bulk action bar */}
          {someSelected && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-200">
              <span className="text-sm font-semibold text-blue-700">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => bulkMutation.mutate({ is_active: true, is_demo: false })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  Set Active
                </button>
                <button
                  onClick={() => bulkMutation.mutate({ is_demo: true, is_active: true })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  Set Demo
                </button>
                <button
                  onClick={() => bulkMutation.mutate({ is_active: false })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Set Inactive
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-slate-600 ml-1">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="pl-4 pr-2 py-3 w-8">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-slate-600 transition-colors">
                    {allSelected ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Client</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Modules</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Users</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(t => {
                const status = statusOf(t)
                const isSelected = selectedIds.has(t.id)
                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''} ${!t.is_active ? 'opacity-60' : ''}`}
                  >
                    <td className="pl-4 pr-2 py-3 w-8">
                      <button onClick={() => toggleRow(t.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        {isSelected ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                      </button>
                    </td>
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
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[status]}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {t.enabled_modules.map(m => (
                          <span key={m} className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">{moduleLabel(m)}</span>
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
                      <div className="flex items-center gap-2 justify-end">
                        {status === 'demo' && (
                          <button
                            onClick={() => goLiveMutation.mutate(t.id)}
                            disabled={goLiveMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                          >
                            <Rocket size={11} />
                            Go live
                          </button>
                        )}
                        {status === 'active' && (
                          <button
                            onClick={() => toggleDemoMutation.mutate({ id: t.id, is_demo: true })}
                            disabled={toggleDemoMutation.isPending}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                          >
                            Set demo
                          </button>
                        )}
                        {status === 'inactive' && (
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: t.id, is_active: true })}
                            disabled={toggleActiveMutation.isPending}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {status !== 'inactive' && (
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: t.id, is_active: !t.is_active })}
                            disabled={toggleActiveMutation.isPending}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                            title={t.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {t.is_active ? <ToggleRight size={14} className="text-emerald-500" /> : <ToggleLeft size={14} className="text-slate-400" />}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingTenant(t)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Edit modules
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <PromoteSuperadminPanel />
      <ResendDiagnosticPanel />

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
      {editingTenant && <EditModulesModal tenant={editingTenant} onClose={() => setEditingTenant(null)} />}
      {viewingUsers && <TenantUsersModal tenant={viewingUsers} onClose={() => setViewingUsers(null)} />}
    </div>
  )
}
