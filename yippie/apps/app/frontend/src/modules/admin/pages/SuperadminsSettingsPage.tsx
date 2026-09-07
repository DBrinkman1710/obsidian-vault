import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, UserPlus, ToggleLeft, ToggleRight, Trash2, Puzzle } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { CloseButton } from '../../../shell/CloseButton'
import { useT } from '../../../hooks/useT'

const ALL_MODULES = ['inbox', 'contacts', 'tickets', 'calendar', 'pipeline', 'booking', 'activity', 'billing', 'contracts', 'chat', 'departments', 'marketing', 'tracking', 'sales', 'saas', 'ai'] as const
type ModuleName = typeof ALL_MODULES[number]
const MODULE_LABELS: Record<ModuleName, string> = {
  inbox: 'Inbox', contacts: 'Contacts', tickets: 'Tickets', calendar: 'Calendar',
  pipeline: 'Pipeline', booking: 'Booking', activity: 'Activity', billing: 'Billing', contracts: 'Contracts', chat: 'Chat', ai: 'AI', departments: 'Departments', marketing: 'Marketing', tracking: 'Tracking', sales: 'Sales', saas: 'SaaS',
}

interface TenantModules { id: string; enabled_modules: string[] }

function GlobalModulesPanel() {
  const t = useT()
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
    tenants.length > 0 && tenants.every((tenant: any) => tenant.enabled_modules.includes(mod))

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-56 flex-shrink-0">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <Puzzle size={14} className="text-slate-400" />
        <div>
          <h2 className="text-xs font-semibold text-slate-600">{t('admin_platform_modules')}</h2>
          <p className="text-[11px] text-slate-400 leading-tight">{t('admin_platform_modules_desc')}</p>
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
                title={active
                  ? t('admin_disable_for_all').replace('{module}', MODULE_LABELS[mod])
                  : t('admin_enable_for_all').replace('{module}', MODULE_LABELS[mod])}
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

const inputCls = 'input-base'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function ToggleConfirmModal({
  target,
  onClose,
}: {
  target: Superadmin
  onClose: () => void
}) {
  const t = useT()
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
    if (!password.trim()) { setError(t('admin_password_required')); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {deactivating ? t('admin_deactivate_superadmin') : t('admin_activate_superadmin')}
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            {deactivating
              ? t('admin_deactivate_desc').replace('{name}', target.full_name)
              : t('admin_activate_desc').replace('{name}', target.full_name)}
          </p>
          <div>
            <label className={labelCls}>{t('admin_your_password')} ({user?.email})</label>
            <input
              className={inputCls}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('admin_confirm_password_ph')}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">{t('admin_cancel')}</button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ${deactivating ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
            >
              {mutation.isPending ? t('admin_saving') : deactivating ? t('admin_deactivate_btn') : t('admin_activate_btn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function InviteSuperadminModal({ onClose }: { onClose: () => void }) {
  const t = useT()
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
      setError(typeof detail === 'string' ? detail : t('admin_failed_invite'))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.current_password.trim()) { setError(t('admin_email_pass_required')); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{t('admin_invite_superadmin')}</h2>
          <CloseButton onClick={onClose} />
        </div>
        {sent ? (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-emerald-600 font-medium">
              {t('admin_invite_sent').replace('{email}', sent)}
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">{t('admin_done')}</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              {t('admin_invite_access_desc')}
            </p>
            <div>
              <label className={labelCls}>{t('admin_full_name_label')}</label>
              <input className={inputCls} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Alex Johnson" autoFocus />
            </div>
            <div>
              <label className={labelCls}>{t('admin_email_label')}</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="naam@bedrijf.nl" />
            </div>
            <div>
              <label className={labelCls}>{t('admin_your_password')} ({user?.email})</label>
              <input className={inputCls} type="password" value={form.current_password} onChange={e => setForm(p => ({ ...p, current_password: e.target.value }))} placeholder={t('admin_confirm_password_ph')} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">{t('admin_cancel')}</button>
              <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed">
                {mutation.isPending ? t('admin_sending') : t('admin_send_invite')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function DeleteSuperadminModal({ target, onClose }: { target: Superadmin; onClose: () => void }) {
  const t = useT()
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
      setError(typeof detail === 'string' ? detail : t('admin_failed_delete_superadmin'))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) { setError(t('admin_password_required')); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-red-600">{t('admin_delete_superadmin')}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700">
              {t('admin_delete_superadmin_desc').replace('{name}', target.full_name).replace('{email}', target.email)}
            </p>
          </div>
          <div>
            <label className={labelCls}>{t('admin_your_password')} ({user?.email})</label>
            <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('admin_confirm_password_ph')} autoFocus />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">{t('admin_cancel')}</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? t('admin_deleting') : t('admin_delete_forever')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SuperadminsSettingsPage() {
  const t = useT()
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
              <h1 className="heading-xl text-slate-900">{t('admin_superadmins_title')}</h1>
            </div>
            <p className="text-sm text-slate-400">
              {t('admin_superadmins_desc')}
            </p>
          </div>
          {isRootOwner && (
            <button
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity flex-shrink-0"
            >
              <UserPlus size={14} />
              {t('admin_invite_superadmin_btn')}
            </button>
          )}
        </div>

        {isLoading && <p className="text-sm text-slate-400">{t('admin_loading')}</p>}

        {data && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_name')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_email')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_status')}</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_added')}</th>
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
                          <span className="ml-2 text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{t('admin_you_badge')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{sa.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${sa.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {sa.is_active ? t('admin_status_active') : t('admin_status_inactive')}
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
                              title={sa.is_active ? t('admin_deactivate_title') : t('admin_activate_title')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              {sa.is_active
                                ? <ToggleRight size={14} className="text-emerald-500" />
                                : <ToggleLeft size={14} className="text-slate-400" />}
                              {sa.is_active ? t('admin_deactivate_title') : t('admin_activate_title')}
                            </button>
                          )}
                          {isRootOwner && !isOwnAccount && !sa.is_root_owner && (
                            <button
                              onClick={() => setDeleting(sa)}
                              title={t('admin_perm_delete_title')}
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
              ? t('admin_root_owner_hint')
              : t('admin_non_root_hint')}
          </p>
        </div>
      </div>

      {/* Platform modules panel */}
      <GlobalModulesPanel />
    </div>
  )
}
