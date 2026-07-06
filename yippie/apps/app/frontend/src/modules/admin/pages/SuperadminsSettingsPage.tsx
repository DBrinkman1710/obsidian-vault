import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, UserPlus, X, ToggleLeft, ToggleRight, Trash2, Puzzle } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

const ALL_MODULES = ['inbox', 'contacts', 'tickets', 'calendar', 'pipeline', 'booking', 'activity', 'billing', 'contracts', 'chat', 'departments', 'marketing', 'tracking', 'sales', 'saas', 'ai'] as const
type ModuleName = typeof ALL_MODULES[number]
const MODULE_LABELS: Record<ModuleName, string> = {
  inbox: 'Inbox', contacts: 'Contacts', tickets: 'Tickets', calendar: 'Calendar',
  pipeline: 'Pipeline', booking: 'Booking', activity: 'Activity', billing: 'Billing', contracts: 'Contracts', chat: 'Chat', ai: 'AI', departments: 'Departments', marketing: 'Marketing', tracking: 'Tracking', sales: 'Sales', saas: 'SaaS',
}

interface TenantModules { id: string; enabled_modules: string[] }

function GlobalModulesPanel() {
  const qc = useQueryClient()
  const [pending, setPending] = useState<string | null>(null)

  const { data: tenants = [] } = useQuery<TenantModules[]>({
    queryKey: ['tenants-modules'],
    queryFn: () => api.get('/admin/tenants').then((r: any) => r.data),
  })

  const mutation = useMutation({
    mutationFn: ({ module, enabled }: { module: string; enabled: boolean }) =>
      api.patch('/admin/modules', { module, enabled }).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants-modules'] }); setPending(null); window.location.reload() },
    onError: () => setPending(null),
  })

  const isEnabled = (mod: string) =>
    tenants.length > 0 && tenants.every((t: any) => t.enabled_modules.includes(mod))

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-56 flex-shrink-0">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Puzzle size={14} className="text-slate-400" />
        <div>
          <h2 className="text-xs font-semibold text-slate-600">Platform Modules</h2>
          <p className="text-[11px] text-slate-400 leading-tight">Toggle for all clients</p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {ALL_MODULES.map(mod => {
          const active = isEnabled(mod)
          const loading = pending === mod && mutation.isPending
          return (
            <div key={mod} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-slate-700">{MODULE_LABELS[mod]}</span>
              <button
                disabled={loading}
                onClick={() => { setPending(mod); mutation.mutate({ module: mod, enabled: !active }) }}
                title={active ? `Disable ${MODULE_LABELS[mod]} for all clients` : `Enable ${MODULE_LABELS[mod]} for all clients`}
                className="transition-opacity disabled:opacity-40"
              >
                {active
                  ? <ToggleRight size={20} className="text-emerald-500" />
                  : <ToggleLeft size={20} className="text-slate-300" />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface Superadmin {
  id: string
  email: string
  full_name: string
  is_active: boolean
  is_root_owner: boolean
  created_at: string
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function ToggleConfirmModal({
  target,
  onClose,
}: {
  target: Superadmin
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const deactivating = target.is_active

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/superadmins/${target.id}`, {
        is_active: !target.is_active,
        current_password: password,
      }).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmins'] }); onClose() },
    onError: (err: any) => setError(err.response?.data?.detail ?? 'Failed'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) { setError('Password required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {deactivating ? 'Deactivate superadmin' : 'Activate superadmin'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            {deactivating
              ? `This will prevent ${target.full_name} from logging in.`
              : `This will restore login access for ${target.full_name}.`}
          </p>
          <div>
            <label className={labelCls}>Your password ({user?.email})</label>
            <input
              className={inputCls}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Confirm with your password"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ${deactivating ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            >
              {mutation.isPending ? 'Saving…' : deactivating ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InviteSuperadminModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ email: '', full_name: '', current_password: '' })
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/admin/superadmins/invite', {
        email: form.email.trim(),
        full_name: form.full_name.trim() || 'Superadmin',
        current_password: form.current_password,
      }).then((r: any) => r.data),
    onSuccess: (data: any) => setSent(data.email),
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to send invite')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.current_password.trim()) { setError('Email and your password are required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Invite superadmin</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {sent ? (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-emerald-600 font-medium">
              ✓ Invite sent to <strong>{sent}</strong>. They appear in this list once they set their password.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              The invitee gets full superadmin access to <strong>this environment</strong> once they set their own password via the emailed link.
            </p>
            <div>
              <label className={labelCls}>Full name</label>
              <input className={inputCls} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Alex Johnson" autoFocus />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="naam@bedrijf.nl" />
            </div>
            <div>
              <label className={labelCls}>Your password ({user?.email})</label>
              <input className={inputCls} type="password" value={form.current_password} onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))} placeholder="Confirm with your password" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed">
                {mutation.isPending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function DeleteSuperadminModal({ target, onClose }: { target: Superadmin; onClose: () => void }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/superadmins/${target.id}/delete`, { current_password: password }).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmins'] }); onClose() },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to delete superadmin')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) { setError('Password required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-red-600">Delete superadmin</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700">
              This permanently removes <strong>{target.full_name}</strong> ({target.email}). <strong>This cannot be undone.</strong> Use Deactivate instead if you only want to suspend access.
            </p>
          </div>
          <div>
            <label className={labelCls}>Your password ({user?.email})</label>
            <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirm with your password" autoFocus />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SuperadminsSettingsPage() {
  const { user } = useAuth()
  const isRootOwner = user?.is_root_owner ?? false
  const [toggling, setToggling] = useState<Superadmin | null>(null)
  const [deleting, setDeleting] = useState<Superadmin | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const { data, isLoading } = useQuery<Superadmin[]>({
    queryKey: ['superadmins'],
    queryFn: () => api.get('/admin/superadmins').then((r: any) => r.data),
  })

  return (
    <div className="flex gap-6 items-start">
      {toggling && <ToggleConfirmModal target={toggling} onClose={() => setToggling(null)} />}
      {deleting && <DeleteSuperadminModal target={deleting} onClose={() => setDeleting(null)} />}
      {showInvite && <InviteSuperadminModal onClose={() => setShowInvite(false)} />}

      {/* Superadmins section */}
      <div className="flex flex-col gap-6 flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={20} className="text-amber-500" />
              <h1 className="text-2xl font-bold text-slate-900">Superadmins</h1>
            </div>
            <p className="text-sm text-slate-400">
              Superadmins in this environment. Scope is limited to this database. Sandbox superadmins are not live superadmins.
            </p>
          </div>
          {isRootOwner && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity flex-shrink-0"
            >
              <UserPlus size={14} />
              Invite superadmin
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

        {data && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Added</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((sa: any) => {
                  const isOwnAccount = sa.email === user?.email
                  return (
                    <tr key={sa.id} className={`hover:bg-slate-50 transition-colors ${!sa.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {sa.full_name}
                        {isOwnAccount && (
                          <span className="ml-2 text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">you</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{sa.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sa.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {sa.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(sa.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {!isOwnAccount && (
                            <button
                              onClick={() => setToggling(sa)}
                              title={sa.is_active ? 'Deactivate' : 'Activate'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              {sa.is_active
                                ? <ToggleRight size={14} className="text-emerald-500" />
                                : <ToggleLeft size={14} className="text-slate-400" />}
                              {sa.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          {isRootOwner && !isOwnAccount && !sa.is_root_owner && (
                            <button
                              onClick={() => setDeleting(sa)}
                              title="Permanently delete this superadmin"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800">
            {isRootOwner
              ? <>New superadmins are added via <strong>invite email</strong>. They set their own password. Deleting is permanent; use Deactivate to suspend access instead.</>
              : <>Only the root owner can invite or delete superadmins. You can deactivate/reactivate accounts with your password.</>}
          </p>
        </div>
      </div>

      {/* Platform modules panel */}
      <GlobalModulesPanel />
    </div>
  )
}
