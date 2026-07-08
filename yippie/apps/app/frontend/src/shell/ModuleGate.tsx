import { createContext, useContext } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useTenantConfig } from '../App'
import { useRbacPermissions } from '../hooks/useRbacPermissions'

interface Props {
  module: string
  children: React.ReactNode
}

const MODULE_LABELS: Record<string, string> = {
  chat: 'Live Chat',
  calendar: 'Calendar',
  pipeline: 'Kanban',
  marketing: 'Marketing',
  tracking: 'Track & Trace',
  shipments: 'Track & Trace',
  sales: 'Sales',
  saas: 'Product Analytics',
  billing: 'Billing',
  contracts: 'Contracts',
  departments: 'Departments',
  flows: 'Flows',
}

/** True inside a module rendered in view-only (RBAC 'view') mode. */
export const RbacViewModeContext = createContext(false)

export function useIsViewOnly() {
  return useContext(RbacViewModeContext)
}

/** Loss-aversion card shown when a module isn't in the tenant's plan. Naming the
 * locked feature with a clear next step converts far better than a silent
 * redirect to the inbox that leaves the user wondering what happened. */
function ModuleLockedCard({ module }: { module: string }) {
  const label = MODULE_LABELS[module] ?? module
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yippie/10 text-yippie">
          <Lock size={22} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{label} isn’t switched on</h2>
        <p className="mt-2 text-sm text-slate-500">
          {label} isn’t part of your workspace yet. Add it to your plan to unlock it for your whole team.
        </p>
        <Link
          to="/settings/subscription"
          className="mt-4 inline-block rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:bg-yippie/90"
        >
          Upgrade plan
        </Link>
        <p className="mt-3 text-xs text-slate-400">
          Need it as an à la carte add-on?{' '}
          <a href="mailto:hello@getyippie.com" className="text-yippie hover:underline">Contact us</a>.
        </p>
      </div>
    </div>
  )
}

export function ModuleGate({ module, children }: Props) {
  const config = useTenantConfig()
  const permissions = useRbacPermissions()

  if (!config) return null
  if (!config.enabled_modules.includes(module)) {
    return <ModuleLockedCard module={module} />
  }

  const level = permissions[module] ?? 'full'

  if (level === 'restricted') {
    return <Navigate to="/" replace />
  }

  if (level === 'view') {
    return (
      <RbacViewModeContext.Provider value={true}>
        {children}
      </RbacViewModeContext.Provider>
    )
  }

  return <>{children}</>
}
