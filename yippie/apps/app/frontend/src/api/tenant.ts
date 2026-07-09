import { api } from './client'

export interface TenantConfig {
  tenant_id: string
  tenant_name: string
  enabled_modules: string[]
  branding: { primary_color: string; logo_url: string | null }
  environment: string
  is_demo: boolean
  is_active: boolean
  // For demo tenants: ISO datetime the demo expires, for a concrete deadline.
  demo_expires_at: string | null
  // [TRIAL30] ISO datetime when the free trial ends; null once converted.
  trial_ends_at: string | null
  // Tenant's SaaS plan tier and the features it unlocks. A feature is usable
  // only when it is in BOTH enabled_modules AND allowed_features.
  plan: string
  allowed_features: string[]
  plan_limits: {
    users: number | null
    contacts: number | null
    ai_scans: number | null
    // Max ENABLED, non default flows (null == unlimited). Default flows are free.
    flows: number | null
    price_monthly: number | null
    price_annual: number | null
    module_discount: number
  }
  module_prices: Record<string, number>
  // When false (default) the inbox AI never runs automatically — agents click
  // Generate per draft. True restores auto-scan-on-arrival.
  ai_auto_scan: boolean
  // Stripe SaaS billing
  stripe_subscription_status: string | null
  stripe_publishable_key: string
  ai_scans_used_this_period: number
  tracking_token: string | null
  ai_profile: {
    business_description?: string
    tone?: string
    reply_language?: string
    sign_off?: string
    common_terms?: string
    faq_context?: string
  } | null
}

export async function fetchTenantConfig(): Promise<TenantConfig> {
  const { data } = await api.get<TenantConfig>('/tenant/config')
  return data
}
