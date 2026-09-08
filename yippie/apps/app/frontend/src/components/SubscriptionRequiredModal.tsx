import { useState } from 'react'
import { Lock, Check } from 'lucide-react'
import { api } from '../api/client'
import { toast } from 'sonner'
import { useT } from '../hooks/useT'
import { useAuth } from '../auth/useAuth'
import { useTenantConfig } from '../App'

/** Hard block shown when tenant config reports subscription_required (the trial
 * or paid subscription lapsed and access_locked_at is stamped server side). The
 * tenant can still log in — that's the point — but the app is walled behind this
 * non dismissable modal until they subscribe. Mirrors the mandatory
 * SetPasswordModal pattern. Checkout + portal reuse the same Stripe endpoints as
 * SubscriptionPage; module APIs return 402 while locked, so this can't be
 * bypassed by poking the UI underneath. The only escape without paying is Log
 * out. */

const PLAN_OPTIONS = [
  { id: 'starter', label: 'Starter', price: 19, descKey: 'admin_plan_starter_desc' },
  { id: 'growth', label: 'Growth', price: 49, descKey: 'admin_plan_growth_desc', popular: true },
  { id: 'enterprise', label: 'Enterprise', price: null as number | null, descKey: 'admin_plan_enterprise_desc' },
]

export default function SubscriptionRequiredModal() {
  const t = useT()
  const { logout } = useAuth()
  const config = useTenantConfig()
  const [interval, setInterval] = useState<'monthly' | 'annual'>('annual')
  const [loading, setLoading] = useState<string | null>(null)

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
      toast.error(t('admin_checkout_error'))
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    try {
      const { data } = await api.post<{ portal_url: string }>('/stripe/portal')
      window.location.href = data.portal_url
    } catch {
      toast.error(t('admin_portal_error'))
      setLoading(null)
    }
  }

  // A tenant that had a subscription (now past_due/canceled) is better served by
  // the billing portal (update card / resubscribe) than a fresh checkout.
  const hadSubscription = !!config?.stripe_subscription_status

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header — no close affordance on purpose. */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yippie/10 text-yippie shrink-0">
            <Lock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-slate-900">{t('sublock_title')}</p>
            <p className="text-sm text-slate-500 mt-0.5">{t('sublock_subtitle')}</p>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* Interval toggle */}
          <div className="flex justify-center mb-5">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs font-medium">
              <button
                onClick={() => setInterval('monthly')}
                className={`px-3 py-1.5 rounded-md transition-all ${interval === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('admin_monthly')}
              </button>
              <button
                onClick={() => setInterval('annual')}
                className={`px-3 py-1.5 rounded-md transition-all ${interval === 'annual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t('admin_annual')} <span className="text-success-600 font-semibold">−10%</span>
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLAN_OPTIONS.map(card => {
              const annualPrice = card.price ? Math.round(card.price * 12 * 0.9) : null
              const displayPrice = interval === 'annual' ? annualPrice : card.price
              return (
                <div
                  key={card.id}
                  className={`rounded-2xl border p-4 flex flex-col gap-3 ${card.popular ? 'border-yippie bg-yippie/5' : 'border-slate-200 bg-white'}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                    {card.popular && (
                      <span className="text-[10px] font-semibold text-success-700 bg-success-50 border border-success-200 px-1.5 py-0.5 rounded-full">{t('admin_most_popular')}</span>
                    )}
                  </div>
                  <div>
                    {displayPrice != null ? (
                      <p className="text-xl font-bold text-slate-900 tracking-tight">
                        €{displayPrice}
                        <span className="text-xs font-normal text-slate-500">/{interval === 'annual' ? t('admin_plan_per_yr') : t('admin_plan_per_mo')}</span>
                      </p>
                    ) : (
                      <p className="text-xl font-bold text-slate-900 tracking-tight">{t('admin_custom_price')}</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 flex-1">{t(card.descKey)}</p>
                  <button
                    onClick={() => handleCheckout(card.id)}
                    disabled={loading === card.id}
                    className={`w-full text-sm font-semibold rounded-xl py-2.5 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                      card.popular ? 'bg-yippie text-white hover:bg-yippie/90' : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {loading === card.id ? t('admin_opening') : card.price == null ? t('admin_contact_us') : (<><Check size={14} />{t('admin_upgrade')}</>)}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer — resubscribe via portal (if they had a sub) + log out escape. */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={() => logout()}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            {t('sublock_logout')}
          </button>
          {hadSubscription && (
            <button
              onClick={handlePortal}
              disabled={loading === 'portal'}
              className="text-xs font-medium text-yippie hover:text-yippie/80 disabled:opacity-50"
            >
              {loading === 'portal' ? t('admin_opening') : t('admin_manage_billing')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
