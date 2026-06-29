import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTenantConfig } from '../../../App'
import { api } from '../../../api/client'
import { toast } from 'sonner'
import { CreditCard, Zap, Users, Cpu } from 'lucide-react'
import { PLAN_LIMITS, PlanTier } from '../../../lib/pricing'

const PLAN_LABELS: Record<string, string> = {
  founder: 'Founder',
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

const PLAN_DESCRIPTIONS: Record<PlanTier, string> = {
  founder:    'Early-adopter plan with generous seat count.',
  starter:    'Perfect for solo agents or small teams.',
  growth:     'For growing teams who want more AI capacity.',
  pro:        'Power users — 10 seats, full AI throughput.',
  enterprise: 'Unlimited seats, custom SLA, and priority support.',
}

const MODULE_LABELS: Record<string, string> = {
  tickets: 'Tickets',
  ai: 'AI Inbox',
  calendar: 'Calendar',
  kanban: 'Kanban',
  chat: 'Live Chat',
  marketing: 'Marketing',
  departments: 'Departments',
  billing: 'Billing',
}

export default function SubscriptionPage() {
  const config = useTenantConfig()
  const location = useLocation()
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  const checkoutSuccess = new URLSearchParams(location.search).get('checkout') === 'success'

  if (!config) return null

  const { plan, plan_limits, module_prices, enabled_modules, ai_scans_used_this_period, stripe_subscription_status } = config
  const aiLimit = plan_limits?.ai_scans ?? null
  const usagePct = aiLimit ? Math.min(100, Math.round((ai_scans_used_this_period / aiLimit) * 100)) : 0

  const paidModules = (enabled_modules || []).filter(m => m in MODULE_LABELS && !['inbox', 'contacts', 'activity'].includes(m))

  async function handleCheckout(planId: string) {
    if (planId === 'enterprise') {
      window.open('https://getyippie.com/contact', '_blank')
      return
    }
    setLoading(planId)
    try {
      const { data } = await api.post<{ checkout_url: string }>('/stripe/checkout', {
        plan: planId,
        interval,
        modules: [],
      })
      window.location.href = data.checkout_url
    } catch {
      toast.error('Could not open checkout. Please try again.')
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    try {
      const { data } = await api.post<{ portal_url: string }>('/stripe/portal')
      window.location.href = data.portal_url
    } catch {
      toast.error('Could not open billing portal. Please try again.')
      setLoading(null)
    }
  }

  const planCards = (Object.entries(PLAN_LIMITS) as [PlanTier, typeof PLAN_LIMITS[PlanTier]][])
    .filter(([id]) => id !== 'founder')
    .map(([id, limits]) => ({ id, limits }))

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Subscription</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your Yippie plan and billing.</p>
      </div>

      {checkoutSuccess && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          Payment successful — your plan has been activated.
        </div>
      )}

      {/* Current plan card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Current plan</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{PLAN_LABELS[plan] ?? plan}</p>
            {stripe_subscription_status && (
              <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
                stripe_subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                stripe_subscription_status === 'past_due' ? 'bg-red-100 text-red-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {stripe_subscription_status}
              </span>
            )}
          </div>
          {stripe_subscription_status && (
            <button
              onClick={handlePortal}
              disabled={loading === 'portal'}
              className="shrink-0 flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 disabled:opacity-50"
            >
              <CreditCard size={14} />
              {loading === 'portal' ? 'Opening…' : 'Manage billing'}
            </button>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-5 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Users size={14} className="text-slate-400" />
            <span>{plan_limits?.users == null ? 'Unlimited' : plan_limits.users} seats</span>
          </div>
          {aiLimit != null && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Cpu size={14} className="text-slate-400" />
              <span>{ai_scans_used_this_period.toLocaleString()} / {aiLimit.toLocaleString()} AI scans this month</span>
            </div>
          )}
        </div>

        {/* AI scan usage bar */}
        {aiLimit != null && (
          <div className="mt-3">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-amber-400' : 'bg-yippie'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        )}

        {/* Active modules */}
        {paidModules.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Active modules</p>
            <div className="flex flex-wrap gap-2">
              {paidModules.map(m => (
                <span key={m} className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                  <Zap size={10} className="text-yippie" />
                  {MODULE_LABELS[m] ?? m}
                  {module_prices?.[m] != null && (
                    <span className="text-slate-400">€{module_prices[m]}/mo</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Plan selector */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Upgrade your plan</h2>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs font-medium">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-3 py-1.5 rounded-md transition-all ${interval === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`px-3 py-1.5 rounded-md transition-all ${interval === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Annual <span className="text-green-600 font-semibold">−10%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {planCards.map(({ id, limits }) => {
            const isCurrent = plan === id
            const displayPrice = interval === 'annual' ? limits.priceAnnual : limits.priceMonthly
            const aiScansDisplay = limits.aiScans != null ? limits.aiScans.toLocaleString() : 'Unlimited'
            return (
              <div
                key={id}
                className={`rounded-2xl border p-5 flex flex-col gap-4 ${isCurrent ? 'border-yippie bg-yippie/5' : 'border-slate-200 bg-white'}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{PLAN_LABELS[id]}</p>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-yippie bg-yippie/10 px-2 py-0.5 rounded-full">Current</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{PLAN_DESCRIPTIONS[id]}</p>
                </div>
                <div>
                  {displayPrice != null ? (
                    <p className="text-2xl font-bold text-slate-900">
                      €{displayPrice}
                      <span className="text-sm font-normal text-slate-500">/{interval === 'annual' ? 'yr' : 'mo'}</span>
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">Custom</p>
                  )}
                </div>
                <ul className="text-xs text-slate-600 space-y-1.5 flex-1">
                  <li className="flex items-center gap-1.5">
                    <Users size={11} className="text-slate-400 shrink-0" />
                    {limits.users == null ? 'Unlimited seats' : `${limits.users} seats`}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Cpu size={11} className="text-slate-400 shrink-0" />
                    {aiScansDisplay} AI scans/mo
                  </li>
                </ul>
                <button
                  onClick={() => handleCheckout(id)}
                  disabled={isCurrent || loading === id}
                  className={`w-full text-sm font-semibold rounded-xl py-2.5 transition-all disabled:opacity-50 ${
                    isCurrent
                      ? 'bg-yippie/10 text-yippie cursor-default'
                      : 'bg-yippie text-white hover:bg-yippie/90'
                  }`}
                >
                  {loading === id ? 'Opening…' : isCurrent ? 'Current plan' : displayPrice == null ? 'Contact us' : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
