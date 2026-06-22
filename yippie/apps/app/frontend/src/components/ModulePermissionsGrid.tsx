import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { AccessLevel } from '../hooks/useRbacPermissions'

type SubjectType = 'user' | 'role' | 'department'

interface Permission {
  id: string
  subject_type: SubjectType
  subject_id: string
  module: string
  access_level: AccessLevel
}

interface Props {
  subjectType: SubjectType
  subjectId: string
  enabledModules: string[]
}

const MODULE_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  contacts: 'Contacts',
  tickets: 'Tickets',
  calendar: 'Calendar',
  pipeline: 'Kanban',
  activity: 'Activity',
  billing: 'Billing',
  chat: 'Live Chat',
  marketing: 'Marketing',
}

const LEVEL_OPTIONS: AccessLevel[] = ['full', 'view', 'restricted']

const LEVEL_CLS: Record<AccessLevel, string> = {
  full: 'text-emerald-700 bg-emerald-50',
  view: 'text-orange-600 bg-orange-50',
  restricted: 'text-red-600 bg-red-50',
}

export function ModulePermissionsGrid({ subjectType, subjectId, enabledModules }: Props) {
  const qc = useQueryClient()

  const { data: allPerms = [] } = useQuery<Permission[]>({
    queryKey: ['rbac-permissions-all'],
    queryFn: () => api.get('/rbac/permissions').then(r => r.data),
  })

  const permMap: Record<string, Permission | undefined> = {}
  for (const p of allPerms) {
    if (p.subject_type === subjectType && p.subject_id === subjectId) {
      permMap[p.module] = p
    }
  }

  const upsertMutation = useMutation({
    mutationFn: (body: { subject_type: SubjectType; subject_id: string; module: string; access_level: AccessLevel }) =>
      api.put('/rbac/permissions', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac-permissions-all'] })
      qc.invalidateQueries({ queryKey: ['rbac-permissions'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rbac/permissions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rbac-permissions-all'] })
      qc.invalidateQueries({ queryKey: ['rbac-permissions'] })
    },
  })

  function handleChange(module: string, level: AccessLevel) {
    const existing = permMap[module]
    if (level === 'full') {
      // Full is the default — remove the override if one exists
      if (existing) deleteMutation.mutate(existing.id)
    } else {
      upsertMutation.mutate({ subject_type: subjectType, subject_id: subjectId, module, access_level: level })
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Module</th>
            <th className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide">Access</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {enabledModules.map(mod => {
            const current: AccessLevel = permMap[mod]?.access_level ?? 'full'
            return (
              <tr key={mod} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-700">{MODULE_LABELS[mod] ?? mod}</td>
                <td className="px-3 py-2">
                  <select
                    value={current}
                    onChange={e => handleChange(mod, e.target.value as AccessLevel)}
                    className={`text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1 ${LEVEL_CLS[current]}`}
                    disabled={upsertMutation.isPending || deleteMutation.isPending}
                  >
                    {LEVEL_OPTIONS.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
