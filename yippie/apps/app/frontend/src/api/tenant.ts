import { api } from './client'

export interface TenantConfig {
  tenant_id: string
  tenant_name: string
  enabled_modules: string[]
  branding: { primary_color: string; logo_url: string | null }
  environment: string
  is_demo: boolean
  is_active: boolean
  // Tenant's SaaS plan tier and the features it unlocks. A feature is usable
  // only when it is in BOTH enabled_modules AND allowed_features.
  plan: string
  allowed_features: string[]
}

export async function fetchTenantConfig(): Promise<TenantConfig> {
  const { data } = await api.get<TenantConfig>('/tenant/config')
  return data
}
