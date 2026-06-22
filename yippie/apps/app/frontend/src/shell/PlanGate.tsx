import { Lock } from 'lucide-react'
import { useTenantConfig } from '../App'

/** The advanced features that are plan-gated. Mirrors ADVANCED_FEATURES on the
 * backend (app/core/plans.py). Core modules (inbox/tickets/contacts/activity/
 * billing) are never plan-gated and don't need a PlanGate wrapper. */
export const PLAN_GATED_FEATURES = ['chat', 'calendar', 'pipeline', 'marketing', 'ai'] as const

const FEATURE_LABELS: Record<string, string> = {
  chat: 'Live chat',
  calendar: 'Calendar',
  pipeline: 'Kanban',
  marketing: 'Marketing',
  ai: 'AI',
}

interface Props {
  feature: string
  children: React.ReactNode
}

/** Gates a feature behind the tenant's plan. Renders a tasteful upgrade card
 * (rather than a broken page or redirect) when the feature isn't in the plan's
 * allowed_features. Compose INSIDE ModuleGate: ModuleGate handles "module off",
 * PlanGate handles "plan too low" for an otherwise-enabled module. */
export function PlanGate({ feature, children }: Props) {
  const config = useTenantConfig()
  if (!config) return null
  // Core features (not in allowed_features list semantics) always pass: the
  // backend always includes core features in allowed_features, so the only way
  // a feature is missing is a genuine plan limit on an advanced feature.
  if (config.allowed_features.includes(feature)) {
    return <>{children}</>
  }
  return <UpgradeGate feature={feature} />
}

function UpgradeGate({ feature }: { feature: string }) {
  const label = FEATURE_LABELS[feature] ?? feature
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yippie/10 text-yippie">
          <Lock size={22} />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{label} is a premium feature</h2>
        <p className="mt-2 text-sm text-slate-500">
          {label} isn’t included in your current plan. Contact your account
          manager to upgrade and unlock it.
        </p>
      </div>
    </div>
  )
}
