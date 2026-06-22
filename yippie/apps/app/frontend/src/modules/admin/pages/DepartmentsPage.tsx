import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Building, Users, X } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

interface DeptMember {
  user_id: string
  email: string
  full_name: string
  role: string
}

interface Dept {
  id: string
  name: string
  email: string
  reply_template: string | null
  sla_working_days: number
  created_at: string
  members?: DeptMember[]
}

interface TeamUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}

interface FormState {
  name: string
  email: string
  reply_template: string
  sla_working_days: string
}

const EMPTY: FormState = { name: '', email: '', reply_template: '', sla_working_days: '3' }

const DEFAULT_TEMPLATE_HINT =
  'Leave blank to use the default: "I\'m sorry to hear about your situation. I have informed my colleagues at {name} about your inquiry. You can expect a response within {sla} working days."'

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-blue-100 text-blue-700',
  agent: 'bg-emerald-100 text-emerald-700',
  viewer: 'bg-slate-100 text-slate-600',
}

function DeptForm({ initial, onSave, onCancel, isPending }: {
  initial: FormState
  onSave: (f: FormState) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<FormState>(initial)
  const [error, setError] = useState('')
  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    if (!form.email.trim()) { setError('Email is required'); return }
    setError('')
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Department name *</label>
          <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Finance" autoFocus />
        </div>
        <div>
          <label className={labelCls}>Email address *</label>
          <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="finance@company.nl" />
        </div>
      </div>
      <div>
        <label className={labelCls}>SLA (working days)</label>
        <input
          className={`${inputCls} w-20`}
          type="number" min={1} max={90}
          value={form.sla_working_days} onChange={set('sla_working_days')}
        />
      </div>
      <div>
        <label className={labelCls}>
          Reply template{' '}
          <span className="font-normal text-slate-400 normal-case">
            — use <code className="text-xs bg-slate-200 px-1 rounded">{'{name}'}</code> and{' '}
            <code className="text-xs bg-slate-200 px-1 rounded">{'{sla}'}</code> as placeholders
          </span>
        </label>
        <textarea
          className={`${inputCls} resize-vertical min-h-[88px] font-[inherit]`}
          value={form.reply_template} onChange={set('reply_template')}
          placeholder={DEFAULT_TEMPLATE_HINT}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-3">
        <button
          type="submit" disabled={isPending}
          className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function DepartmentDetailModal({ dept, onClose }: { dept: Dept; onClose: () => void }) {
  const qc = useQueryClient()

  // --- Settings ---
  const [name, setName] = useState(dept.name)
  const [email, setEmail] = useState(dept.email)
  const [sla, setSla] = useState(String(dept.sla_working_days))
  const [template, setTemplate] = useState(dept.reply_template ?? '')
  const [savedSettings, setSavedSettings] = useState(false)

  const saveSettings = useMutation({
    mutationFn: () => api.patch(`/departments/${dept.id}`, {
      name: name.trim(), email: email.trim(),
      reply_template: template.trim() || null,
      sla_working_days: parseInt(sla) || 3,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      setSavedSettings(true)
      setTimeout(() => setSavedSettings(false), 2000)
    },
  })

  // --- Members ---
  const { data: members } = useQuery<DeptMember[]>({
    queryKey: ['departments', dept.id, 'members'],
    queryFn: () => api.get(`/departments/${dept.id}/members`).then(r => r.data),
  })

  const { data: teamUsers } = useQuery<TeamUser[]>({
    queryKey: ['team', 'users'],
    queryFn: () => api.get('/team/users').then(r => r.data),
  })

  const refreshMembers = () => {
    qc.invalidateQueries({ queryKey: ['departments', dept.id, 'members'] })
    qc.invalidateQueries({ queryKey: ['departments'] })
  }

  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/departments/${dept.id}/members/${userId}`),
    onSuccess: refreshMembers,
  })

  const [addUserId, setAddUserId] = useState('')
  const addMember = useMutation({
    mutationFn: (userId: string) => api.post(`/departments/${dept.id}/members`, { user_id: userId }),
    onSuccess: () => { setAddUserId(''); refreshMembers() },
  })

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('agent')
  const [inviteError, setInviteError] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const invite = useMutation({
    mutationFn: () => api.post(`/departments/${dept.id}/members/invite`, {
      email: inviteEmail.trim(), full_name: inviteName.trim(), role: inviteRole,
    }),
    onSuccess: (r) => {
      setInviteError('')
      setInviteMsg(r.data?.invited ? `Invite sent to ${r.data.email}` : `${r.data.email} added to department`)
      setInviteEmail(''); setInviteName('')
      refreshMembers()
      qc.invalidateQueries({ queryKey: ['team', 'users'] })
      setTimeout(() => setInviteMsg(''), 3000)
    },
    onError: (e: any) => {
      setInviteMsg('')
      setInviteError(e?.response?.data?.detail || 'Could not invite user')
    },
  })

  const memberIds = new Set((members ?? []).map(m => m.user_id))
  const addableUsers = (teamUsers ?? []).filter(u => !memberIds.has(u.id))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-900">{dept.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-6">
          {/* Section 1 — Settings */}
          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Name</label>
                <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelCls}>SLA (working days)</label>
              <input
                className={`${inputCls} w-24`}
                type="number" min={1} max={90}
                value={sla} onChange={e => setSla(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Reply template</label>
              <textarea
                className={`${inputCls} resize-vertical min-h-[80px] font-[inherit]`}
                value={template} onChange={e => setTemplate(e.target.value)}
                placeholder={DEFAULT_TEMPLATE_HINT}
              />
            </div>
            <div>
              <button
                onClick={() => saveSettings.mutate()}
                disabled={saveSettings.isPending}
                className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
              >
                {saveSettings.isPending ? 'Saving…' : savedSettings ? 'Saved ✓' : 'Save settings'}
              </button>
            </div>
          </section>

          <div className="border-t border-slate-100" />

          {/* Section 2 — Members */}
          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Members</h3>

            <div className="flex flex-col gap-2">
              {(members ?? []).length === 0 && (
                <p className="text-sm text-slate-400">No members yet.</p>
              )}
              {(members ?? []).map(m => (
                <div key={m.user_id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[m.role] ?? 'bg-slate-100 text-slate-600'}`}>
                      {m.role}
                    </span>
                    <button
                      onClick={() => removeMember.mutate(m.user_id)}
                      disabled={removeMember.isPending}
                      className="text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
                      title="Remove from department"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add existing user */}
            <div>
              <label className={labelCls}>Add existing user</label>
              <div className="flex gap-2">
                <select
                  className={inputCls}
                  value={addUserId}
                  onChange={e => setAddUserId(e.target.value)}
                >
                  <option value="">Select a user…</option>
                  {addableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
                <button
                  onClick={() => addUserId && addMember.mutate(addUserId)}
                  disabled={!addUserId || addMember.isPending}
                  className="px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Invite new user */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Invite new user</p>
              <input
                className={inputCls} type="email" placeholder="email@company.nl"
                value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              />
              <input
                className={inputCls} placeholder="Full name"
                value={inviteName} onChange={e => setInviteName(e.target.value)}
              />
              <select
                className={inputCls}
                value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
              {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
              {inviteMsg && <p className="text-sm text-emerald-600">{inviteMsg}</p>}
              <button
                onClick={() => invite.mutate()}
                disabled={!inviteEmail.trim() || !inviteName.trim() || invite.isPending}
                className="self-start px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
              >
                {invite.isPending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

interface DeadlineSettings {
  deadline_red_days: number
  deadline_orange_days: number
}

function DeadlineSettingsCard() {
  const qc = useQueryClient()
  const [red, setRed] = useState('1')
  const [orange, setOrange] = useState('2')
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)

  useQuery<DeadlineSettings>({
    queryKey: ['deadline-settings'],
    queryFn: async () => {
      const { data } = await api.get('/departments/deadline-settings')
      setRed(String(data.deadline_red_days))
      setOrange(String(data.deadline_orange_days))
      setLoaded(true)
      return data
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/departments/deadline-settings', {
      deadline_red_days: parseInt(red) || 0,
      deadline_orange_days: parseInt(orange) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', 'deadline-count'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="mb-8 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900 mb-1">Deadline indicator</h2>
      <p className="text-sm text-slate-500 mb-4">
        Controls the coloured dot on the Tickets menu item. A{' '}
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 align-middle" /> red dot
        appears when tickets are overdue or due within the red window; an{' '}
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 align-middle" /> orange
        dot when tickets are due within the orange window.
      </p>
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <label className={labelCls}>Red — due within (days)</label>
          <input
            className={`${inputCls} w-24`}
            type="number" min={0} max={90}
            value={red} onChange={e => setRed(e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Orange — due within (days)</label>
          <input
            className={`${inputCls} w-24`}
            type="number" min={0} max={90}
            value={orange} onChange={e => setOrange(e.target.value)}
          />
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!loaded || saveMutation.isPending}
          className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function DepartmentsPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [openDept, setOpenDept] = useState<Dept | null>(null)

  const { data: departments, isLoading } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (f: FormState) => api.post('/departments', {
      name: f.name.trim(), email: f.email.trim(),
      reply_template: f.reply_template.trim() || null,
      sla_working_days: parseInt(f.sla_working_days) || 3,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setShowCreate(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  })

  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return <p className="text-sm text-red-500 p-8">Access denied — admin only.</p>
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Departments</h1>
          <p className="text-sm text-slate-500">
            Route inbox messages to specialist departments. Click a department to manage settings and members.
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={2.5} />
            New Department
          </button>
        )}
      </div>

      <DeadlineSettingsCard />

      {showCreate && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New Department</p>
          <DeptForm
            initial={EMPTY}
            onSave={f => createMutation.mutate(f)}
            onCancel={() => setShowCreate(false)}
            isPending={createMutation.isPending}
          />
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && departments?.length === 0 && !showCreate && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No departments yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to start routing inbox messages.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {departments?.map(dept => (
          <div
            key={dept.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpenDept(dept)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenDept(dept) } }}
            className="cursor-pointer text-left bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between shadow-sm hover:border-blue-300 hover:shadow transition-all"
          >
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-bold text-slate-900">{dept.name}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700">
                  {dept.sla_working_days}d SLA
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                  <Users size={11} />
                  {dept.members?.length ?? 0}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-0.5">{dept.email}</p>
              <p className="text-xs text-slate-400 italic">
                {dept.reply_template ? 'Custom template set' : 'Using default template'}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${dept.name}"?`)) deleteMutation.mutate(dept.id) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 ml-4"
            >
              <Trash2 size={11} />
              Delete
            </button>
          </div>
        ))}
      </div>

      {openDept && (
        <DepartmentDetailModal dept={openDept} onClose={() => setOpenDept(null)} />
      )}
    </div>
  )
}
