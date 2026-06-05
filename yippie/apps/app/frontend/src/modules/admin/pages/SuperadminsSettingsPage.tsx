import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, X } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

interface Superadmin {
  id: string
  email: string
  full_name: string
  is_active: boolean
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
      }).then(r => r.data),
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
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

export default function SuperadminsSettingsPage() {
  const { user } = useAuth()
  const [toggling, setToggling] = useState<Superadmin | null>(null)

  const { data, isLoading } = useQuery<Superadmin[]>({
    queryKey: ['superadmins'],
    queryFn: () => api.get('/admin/superadmins').then(r => r.data),
  })

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {toggling && <ToggleConfirmModal target={toggling} onClose={() => setToggling(null)} />}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-amber-500" />
          <h1 className="text-2xl font-bold text-slate-900">Superadmins</h1>
        </div>
        <p className="text-sm text-slate-400">
          Superadmins in this environment. Scope is limited to this database — sandbox superadmins are not live superadmins.
        </p>
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
              {data.map(sa => {
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
                      {!isOwnAccount && (
                        <button
                          onClick={() => setToggling(sa)}
                          className={`px-3 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${
                            sa.is_active
                              ? 'text-red-500 border-red-200 hover:bg-red-50'
                              : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          {sa.is_active ? 'Deactivate' : 'Activate'}
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

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800">
          <strong>To add a new superadmin</strong>, use the "Promote to superadmin" panel on the Clients page, or use the create superadmin flow (coming soon — requires invite email).
        </p>
      </div>
    </div>
  )
}
