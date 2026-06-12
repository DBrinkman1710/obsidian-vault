import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, X, Plus, Pencil, Trash2, Building } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

interface TeamUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

const ROLE_PILL: Record<string, string> = {
  superadmin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  agent: 'bg-emerald-100 text-emerald-700',
  viewer: 'bg-slate-100 text-slate-500',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 mb-1.5'

interface Dept { id: string; name: string; email: string; sla_working_days: number }
type DeptForm = { name: string; email: string; sla_working_days: string }
const DEPT_EMPTY: DeptForm = { name: '', email: '', sla_working_days: '3' }

function DeptModal({ dept, onClose }: { dept?: Dept; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<DeptForm>(dept
    ? { name: dept.name, email: dept.email, sla_working_days: String(dept.sla_working_days) }
    : DEPT_EMPTY)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => dept
      ? api.patch(`/departments/${dept.id}`, { name: form.name.trim(), email: form.email.trim(), sla_working_days: parseInt(form.sla_working_days) || 3 })
      : api.post('/departments', { name: form.name.trim(), email: form.email.trim(), sla_working_days: parseInt(form.sla_working_days) || 3 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); onClose() },
    onError: () => setError('Failed to save'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{dept ? 'Edit' : 'New'} Department</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Finance" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="finance@company.nl" />
          </div>
          <div>
            <label className={labelCls}>SLA (working days)</label>
            <input className={`${inputCls} w-24`} type="number" min={1} max={90} value={form.sla_working_days} onChange={e => setForm(p => ({ ...p, sla_working_days: e.target.value }))} />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DepartmentsPanel() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Dept | null>(null)

  const { data: departments, isLoading } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })

  return (
    <div className="w-72 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Departments</h2>
          <p className="text-xs text-slate-400 mt-0.5">Route inbox messages to specialist teams.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {isLoading && <p className="text-xs text-slate-400">Loading…</p>}

      {!isLoading && (!departments || departments.length === 0) && (
        <div className="text-center py-8 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building size={24} className="text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">No departments yet</p>
        </div>
      )}

      {departments && departments.length > 0 && (
        <div className="flex flex-col gap-2">
          {departments.map(dept => (
            <div key={dept.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-2 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-slate-900 truncate">{dept.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 shrink-0">{dept.sla_working_days}d</span>
                </div>
                <p className="text-xs text-slate-400 truncate">{dept.email}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setEditing(dept)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors" title="Edit">
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${dept.name}"?`)) deleteMutation.mutate(dept.id) }}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors" title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <DeptModal onClose={() => setShowNew(false)} />}
      {editing && <DeptModal dept={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ email: '', full_name: '', role: 'agent' })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post('/team/invite', form).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-users'] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to send invite'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.full_name.trim()) { setError('Name and email are required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Invite team member</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Name</label>
            <input className={inputCls} value={form.full_name} autoFocus
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Jan de Vries" />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input className={inputCls} type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="jan@company.nl" />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="agent">Agent — handles tickets and inbox</option>
              <option value="admin">Admin — can manage settings and team</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
          </div>
          <p className="text-xs text-slate-400">
            They'll receive an email with a link to set their own password. The link is valid for 7 days.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={mutation.isPending}
            className="px-5 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity">
            {mutation.isPending ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function TeamSettingsPage() {
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const [showInvite, setShowInvite] = useState(false)
  const [error, setError] = useState('')

  const { data: users, isLoading } = useQuery<TeamUser[]>({
    queryKey: ['team-users'],
    queryFn: () => api.get('/team/users').then(r => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; is_active?: boolean; role?: string }) =>
      api.patch(`/team/users/${id}`, patch).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-users'] }); setError('') },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Update failed'),
  })

  return (
    <div className="flex gap-8 items-start">
      {/* Team list */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Team</h1>
            <p className="text-sm text-slate-500">Invite and manage the people in your workspace.</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            <UserPlus size={15} />
            Invite
          </button>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

        {users && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Last login</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const isSelf = u.id === me?.id
                  const isSuperadmin = u.role === 'superadmin'
                  const locked = isSelf || isSuperadmin
                  return (
                    <tr key={u.id} className={!u.is_active ? 'opacity-50' : ''}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{u.full_name}{isSelf && <span className="text-slate-400 font-normal"> (you)</span>}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {locked ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${ROLE_PILL[u.role] ?? ROLE_PILL.viewer}`}>{u.role}</span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={e => updateMutation.mutate({ id: u.id, role: e.target.value })}
                            className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1 capitalize"
                          >
                            <option value="admin">admin</option>
                            <option value="agent">agent</option>
                            <option value="viewer">viewer</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!locked && (
                          <button
                            onClick={() => updateMutation.mutate({ id: u.id, is_active: !u.is_active })}
                            disabled={updateMutation.isPending}
                            className={`px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors disabled:opacity-50 ${
                              u.is_active
                                ? 'text-slate-500 border-slate-200 hover:bg-slate-50'
                                : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
      </div>

      {/* Departments panel */}
      <DepartmentsPanel />
    </div>
  )
}
