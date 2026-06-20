import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, X, Plus, Pencil, Trash2, Building, ChevronDown, ChevronRight, Shield } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { TemplatePicker } from '../../inbox/components/TemplatePicker'
import { ModulePermissionsGrid } from '../../../components/ModulePermissionsGrid'
import { useTenantConfig } from '../../../App'

interface TeamUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

interface RbacRole { id: string; name: string; created_at: string }
interface UserRbacRole { id: string; role_id: string; role_name: string }

const ROLE_PILL: Record<string, string> = {
  superadmin: 'bg-purple-100 text-purple-700',
  admin: 'bg-blue-100 text-blue-700',
  agent: 'bg-emerald-100 text-emerald-700',
  viewer: 'bg-slate-100 text-slate-500',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie'
const labelCls = 'block text-xs font-semibold text-slate-500 mb-1.5'

interface Dept { id: string; name: string; email: string; sla_working_days: number; reply_template: string | null }
type DeptForm = { name: string; email: string; sla_working_days: string; reply_template: string }
const DEPT_EMPTY: DeptForm = { name: '', email: '', sla_working_days: '3', reply_template: '' }

function DeptModal({ dept, onClose }: { dept?: Dept; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<DeptForm>(dept
    ? { name: dept.name, email: dept.email, sla_working_days: String(dept.sla_working_days), reply_template: dept.reply_template ?? '' }
    : DEPT_EMPTY)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        sla_working_days: parseInt(form.sla_working_days) || 3,
        reply_template: form.reply_template.trim() || null,
      }
      return dept ? api.patch(`/departments/${dept.id}`, payload) : api.post('/departments', payload)
    },
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
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
          <div>
            <label className={labelCls}>Default reply template</label>
            <div className="flex items-center gap-2 mb-1.5">
              <TemplatePicker
                onSelect={(body) => setForm(p => ({ ...p, reply_template: body.replace(/<[^>]*>/g, '').trim() }))}
                direction="down"
              />
              {form.reply_template && (
                <button type="button" onClick={() => setForm(p => ({ ...p, reply_template: '' }))}
                  className="text-xs text-red-500 hover:text-red-700 font-medium">
                  Clear
                </button>
              )}
            </div>
            {form.reply_template ? (
              <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border border-slate-200 line-clamp-3">
                {form.reply_template}
              </p>
            ) : (
              <p className="text-xs text-slate-400">No template selected</p>
            )}
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
    <div className="w-96 flex-shrink-0">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Departments</h2>
          <p className="text-sm text-slate-500">Route messages to specialist teams.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <Plus size={15} />
          Add
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {isLoading && (
          <p className="text-xs text-slate-400 px-4 py-6 text-center">Loading…</p>
        )}

        {!isLoading && (!departments || departments.length === 0) && (
          <div className="text-center py-10">
            <Building size={24} className="text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No departments yet</p>
          </div>
        )}

        {departments && departments.length > 0 && (
          <div className="divide-y divide-slate-100">
            {departments.map(dept => (
              <div key={dept.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-900 truncate">{dept.name}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 shrink-0">{dept.sla_working_days}d</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{dept.email}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing(dept)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors" title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${dept.name}"?`)) deleteMutation.mutate(dept.id) }}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors" title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && <DeptModal onClose={() => setShowNew(false)} />}
      {editing && <DeptModal dept={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ email: '', full_name: '', role: 'agent' })
  const [selectedRbacRoles, setSelectedRbacRoles] = useState<string[]>([])
  const [error, setError] = useState('')

  const { data: availableRoles = [] } = useQuery<RbacRole[]>({
    queryKey: ['rbac-roles'],
    queryFn: () => api.get('/rbac/roles').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: () => api.post('/team/invite', { ...form, rbac_role_ids: selectedRbacRoles }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-users'] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to send invite'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.full_name.trim()) { setError('Name and email are required'); return }
    setError('')
    mutation.mutate()
  }

  function toggleRole(id: string) {
    setSelectedRbacRoles(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
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
            <label className={labelCls}>System role</label>
            <select className={inputCls} value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="agent">Agent — handles tickets and inbox</option>
              <option value="admin">Admin — can manage settings and team</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
          </div>
          {availableRoles.length > 0 && (
            <div>
              <label className={labelCls}>Access roles <span className="font-normal text-slate-400">(optional)</span></label>
              <div className="flex flex-wrap gap-2">
                {availableRoles.map(r => {
                  const selected = selectedRbacRoles.includes(r.id)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {r.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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

function DeleteUserModal({ user, onClose }: { user: TeamUser; onClose: () => void }) {
  const qc = useQueryClient()
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.delete(`/team/users/${user.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team-users'] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed to delete user'),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Delete team member</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold text-slate-900">{user.full_name}</span>? This cannot be undone.
          </p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {mutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User row — expandable RBAC section
// ---------------------------------------------------------------------------

function UserRbacRow({ user, enabledModules }: { user: TeamUser; enabledModules: string[] }) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const { data: assignedRoles = [] } = useQuery<UserRbacRole[]>({
    queryKey: ['user-rbac-roles', user.id],
    queryFn: () => api.get(`/rbac/users/${user.id}/roles`).then(r => r.data),
    enabled: expanded,
  })

  const { data: allRoles = [] } = useQuery<RbacRole[]>({
    queryKey: ['rbac-roles'],
    queryFn: () => api.get('/rbac/roles').then(r => r.data),
    enabled: expanded,
  })

  const assignMutation = useMutation({
    mutationFn: (roleId: string) => api.post(`/rbac/users/${user.id}/roles/${roleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-rbac-roles', user.id] }),
  })

  const removeMutation = useMutation({
    mutationFn: (roleId: string) => api.delete(`/rbac/users/${user.id}/roles/${roleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-rbac-roles', user.id] }),
  })

  const assignedRoleIds = new Set(assignedRoles.map(r => r.role_id))
  const unassignedRoles = allRoles.filter(r => !assignedRoleIds.has(r.id))

  return (
    <>
      <tr className="border-t border-slate-100">
        <td colSpan={4} className="p-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className={`w-full flex items-center gap-2 px-4 py-2 text-xs font-medium transition-colors text-left ${
              expanded ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Shield size={13} className={expanded ? 'text-blue-500' : 'text-slate-400'} />
            Access roles &amp; permissions
            {expanded ? <ChevronDown size={12} className="ml-auto" /> : <ChevronRight size={12} className="ml-auto" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} className="px-4 pb-4">
            {/* RBAC roles */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 mb-2">Assigned roles</p>
              <div className="flex flex-wrap gap-2">
                {assignedRoles.map(r => (
                  <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                    {r.role_name}
                    <button
                      onClick={() => removeMutation.mutate(r.role_id)}
                      disabled={removeMutation.isPending}
                      className="hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {unassignedRoles.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value) assignMutation.mutate(e.target.value) }}
                    disabled={assignMutation.isPending}
                    className="text-xs border border-dashed border-slate-300 rounded-full px-2 py-0.5 text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <option value="" disabled>+ Add role</option>
                    {unassignedRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
                {assignedRoles.length === 0 && unassignedRoles.length === 0 && (
                  <p className="text-xs text-slate-400">No roles defined yet — create them in the Roles tab.</p>
                )}
              </div>
            </div>

            {/* Per-module override grid */}
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Per-module override <span className="font-normal text-slate-400">(user-level, overrides role/dept)</span></p>
              <ModulePermissionsGrid
                subjectType="user"
                subjectId={user.id}
                enabledModules={enabledModules}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Roles tab
// ---------------------------------------------------------------------------

function RolesTab({ enabledModules }: { enabledModules: string[] }) {
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [error, setError] = useState('')

  const { data: roles = [], isLoading } = useQuery<RbacRole[]>({
    queryKey: ['rbac-roles'],
    queryFn: () => api.get('/rbac/roles').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/rbac/roles', { name: newName.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac-roles'] }); setNewName(''); setError('') },
    onError: () => setError('Failed to create role'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rbac/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rbac-roles'] }); qc.invalidateQueries({ queryKey: ['rbac-permissions-all'] }) },
  })

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) { setError('Role name is required'); return }
    createMutation.mutate()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Access Roles</h2>
          <p className="text-sm text-slate-500">Define roles with per-module access levels, then assign them to team members.</p>
        </div>
      </div>

      {/* Create role */}
      <form onSubmit={handleCreate} className="flex items-center gap-3 mb-6">
        <input
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          placeholder="New role name (e.g. Finance Viewer)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus size={15} />
          Create role
        </button>
      </form>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && roles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Shield size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No roles yet</p>
          <p className="text-xs text-slate-400 mt-1">Create a role to define module-level access for a group of users.</p>
        </div>
      )}

      {roles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {roles.map(role => (
            <div key={role.id}>
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-900"
                >
                  {expandedRole === role.id ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  {role.name}
                </button>
                <button
                  onClick={() => { if (confirm(`Delete role "${role.name}"?`)) deleteMutation.mutate(role.id) }}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                  title="Delete role"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {expandedRole === role.id && (
                <div className="px-4 pb-4 pt-1 bg-slate-50 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Set module access for users assigned this role.</p>
                  <ModulePermissionsGrid
                    subjectType="role"
                    subjectId={role.id}
                    enabledModules={enabledModules}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = 'members' | 'roles'

export default function TeamSettingsPage() {
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const config = useTenantConfig()
  const [tab, setTab] = useState<Tab>('members')
  const [showInvite, setShowInvite] = useState(false)
  const [deletingUser, setDeletingUser] = useState<TeamUser | null>(null)
  const [error, setError] = useState('')

  const enabledModules = config?.enabled_modules ?? []

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

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`

  return (
    <div className="flex gap-8 items-start">
      <div className="flex-1 min-w-0">
        {/* Tab bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="inline-flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button className={tabCls('members')} onClick={() => setTab('members')}>Members</button>
            <button className={tabCls('roles')} onClick={() => setTab('roles')}>
              <span className="flex items-center gap-1.5"><Shield size={13} />Roles</span>
            </button>
          </div>
          {tab === 'members' && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <UserPlus size={15} />
              Invite
            </button>
          )}
        </div>

        {tab === 'members' && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-1">Team</h1>
              <p className="text-sm text-slate-500">Invite and manage the people in your workspace.</p>
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
                  <tbody>
                    {users.map(u => {
                      const isSelf = u.id === me?.id
                      const isSuperadmin = u.role === 'superadmin'
                      const locked = isSelf || isSuperadmin
                      return (
                        <React.Fragment key={u.id}>
                          <tr className={!u.is_active ? 'opacity-50' : ''}>
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
                                <div className="flex items-center justify-end gap-2">
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
                                  <button
                                    onClick={() => setDeletingUser(u)}
                                    className="p-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {/* RBAC expand row — only for non-admin, non-self users */}
                          {!isSuperadmin && enabledModules.length > 0 && (
                            <UserRbacRow user={u} enabledModules={enabledModules} />
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
            {deletingUser && <DeleteUserModal user={deletingUser} onClose={() => setDeletingUser(null)} />}
          </>
        )}

        {tab === 'roles' && <RolesTab enabledModules={enabledModules} />}
      </div>

      {/* Departments panel */}
      <DepartmentsPanel />
    </div>
  )
}
