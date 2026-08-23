import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, X, Building2, UserPlus,
  ToggleLeft, ToggleRight, Rocket, FlaskConical, CheckSquare, Square,
  Clipboard, Check, Eye, Trash2, Pencil, Lock,
  LayoutDashboard, AlertTriangle, Inbox, Sparkles, Ticket as TicketIcon,
  Globe, ShieldCheck, RefreshCw, Copy,
} from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'
import { useCopy } from '../../../hooks/useCopy'
import { CloseButton } from '../../../shell/CloseButton'
import { useT } from '../../../hooks/useT'

const ALL_MODULES = ['inbox', 'contacts', 'tickets', 'calendar', 'pipeline', 'booking', 'activity', 'flows', 'billing', 'contracts', 'chat', 'departments', 'marketing', 'tracking', 'sales', 'saas', 'ai']

const MODULE_LABELS: Record<string, string> = { pipeline: 'Kanban', ai: 'AI', booking: 'Booking', departments: 'Departments', marketing: 'Marketing', tracking: 'Tracking', sales: 'Sales', saas: 'SaaS', contracts: 'Contracts', flows: 'Flows' }
const moduleLabel = (mod: string) => MODULE_LABELS[mod] ?? mod

// SaaS plan tiers — mirrors PlanTier on the backend (app/core/plans.py).
const PLAN_TIERS = ['founder', 'starter', 'growth', 'pro'] as const
const planLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)

// AI scan limits per plan — mirrors PLAN_LIMITS in app/core/plans.py.
const PLAN_AI_LIMITS: Record<string, number | null> = {
  founder: 500, starter: 2_000, growth: 5_000, pro: 10_000, enterprise: null,
}

// Per-plan badge color — distinct pill colors so plan distribution is visible at a glance.
const PLAN_BADGE: Record<string, string> = {
  founder:    'bg-violet-100 text-violet-700',
  starter:    'bg-sky-100 text-sky-700',
  growth:     'bg-emerald-100 text-emerald-700',
  pro:        'bg-amber-100 text-amber-700',
  enterprise: 'bg-slate-200 text-slate-700',
}

type FilterStatus = 'all' | 'active' | 'demo' | 'inactive'

interface DnsRecord {
  record: string
  name: string
  type: string
  ttl: string
  status: string
  value: string
  priority?: number
}

interface Tenant {
  id: string
  slug: string
  name: string
  enabled_modules: string[]
  plan: string
  primary_color: string
  logo_url: string | null
  is_active: boolean
  is_demo: boolean
  demo_expires_at: string | null
  go_live_at: string | null
  inbound_email: string | null
  kvk_nummer: string | null
  btw_nummer: string | null
  street_address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  iban: string | null
  phone: string | null
  whatsapp_phone_number_id: string | null
  whatsapp_access_token: string | null
  whatsapp_verify_token: string | null
  ai_auto_scan: boolean
  lead_widget_save_contact: boolean
  lead_widget_stage_id: string | null
  resend_domain_id: string | null
  resend_domain_name: string | null
  resend_domain_status: string | null
  resend_domain_records: DnsRecord[] | null
  user_count: number
  created_at: string
}

interface TenantUser {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

const ROLE_STYLES: Record<string, string> = {
  superadmin: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-700',
  agent: 'bg-slate-100 text-slate-600',
  viewer: 'bg-slate-100 text-slate-500',
}

interface CreateForm {
  name: string
  slug: string
  admin_full_name: string
  admin_email: string
  admin_password: string
  extra_admin_emails: string[]
  primary_color: string
  logo_url: string
  enabled_modules: string[]
  is_demo: boolean
  inbound_email: string
}

const EMPTY_FORM: CreateForm = {
  name: '', slug: '', admin_full_name: '', admin_email: '', admin_password: '',
  extra_admin_emails: [], primary_color: '#5BA4F5', logo_url: '',
  enabled_modules: [...ALL_MODULES], is_demo: false, inbound_email: '',
}

const WIZARD_STEPS = ['Company', 'Modules', 'Branding', 'Admins', 'Go live']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function demoDaysRemaining(expiresAt: string | null): number {
  if (!expiresAt) return 7
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/** Inline validation for invite/admin email fields: format + already-in-use,
 * checked ~500ms after the user stops typing instead of failing on submit.
 * Returns null while typing or when the address is fine. */
function useEmailCheckError(email: string, t: (key: string) => string): string | null {
  const trimmed = email.trim().toLowerCase()
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), 500)
    return () => clearTimeout(timer)
  }, [trimmed])

  const settled = debounced === trimmed && trimmed.length > 0
  const validFormat = EMAIL_RE.test(trimmed)

  const { data } = useQuery<{ available: boolean; reason: string | null }>({
    queryKey: ['check-email', debounced],
    queryFn: () => api.get('/admin/check-email', { params: { email: debounced } }).then((r: any) => r.data),
    enabled: settled && validFormat,
    staleTime: 30_000,
  })

  if (!settled) return null
  if (!validFormat) return t('admin_email_not_valid')
  if (data && !data.available) return data.reason ?? t('admin_email_unavailable')
  return null
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

function useSlugCheckError(slug: string, t: (key: string) => string): string | null {
  const trimmed = slug.trim().toLowerCase()
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), 400)
    return () => clearTimeout(timer)
  }, [trimmed])

  const settled = debounced === trimmed && trimmed.length > 0

  const { data } = useQuery<{ available: boolean; reason: string | null }>({
    queryKey: ['check-slug', debounced],
    queryFn: () => api.get('/admin/check-slug', { params: { slug: debounced } }).then((r: any) => r.data),
    enabled: settled && trimmed.length >= 2,
    staleTime: 30_000,
  })

  if (!settled) return null
  if (trimmed.length < 2) return t('admin_slug_min2')
  if (!SLUG_RE.test(trimmed)) return t('admin_slug_format')
  if (data && !data.available) return data.reason ?? t('admin_slug_unavailable')
  return null
}

const inputCls = 'input-base'
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5'

function statusOf(t: Tenant): 'active' | 'demo' | 'inactive' {
  if (!t.is_active) return 'inactive'
  if (t.is_demo) return 'demo'
  return 'active'
}

const STATUS_PILL: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  demo: 'bg-amber-100 text-amber-700',
  inactive: 'bg-slate-100 text-slate-400',
}

function DonutChart({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <span className="text-xs text-slate-400" title="Unlimited AI scans">∞</span>
    )
  }
  const pct = Math.min(used / Math.max(limit, 1), 1)
  // neutral below 75 %, orange 75–99 %, red at 100 %
  const stroke = pct >= 1 ? '#ef4444' : pct >= 0.75 ? '#f59e0b' : '#3b82f6'
  const r = 14, cx = 20, cy = 20
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  return (
    <div className="flex flex-col items-center gap-0.5" title={`${used} / ${limit} AI scans this month`}>
      <svg width={40} height={40} viewBox="0 0 40 40">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span className="text-[9px] text-slate-400 tabular-nums leading-none">{used}/{limit}</span>
    </div>
  )
}

function ModuleToggle({ mod, active, onClick }: { mod: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
    >
      {moduleLabel(mod)}
    </button>
  )
}

function CreateClientModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [extraEmail, setExtraEmail] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ invites: string[]; tenant: Tenant } | null>(null)
  const [domainSetupTenant, setDomainSetupTenant] = useState<Tenant | null>(null)
  const [dnsViewTenant, setDnsViewTenant] = useState<Tenant | null>(null)
  const { copy: copyUrl, copied: copiedLoginUrl } = useCopy({ useToast: false })

  const adminEmailError = useEmailCheckError(form.admin_email, t)
  const extraEmailError = useEmailCheckError(extraEmail, t)
  const slugError = useSlugCheckError(form.slug, t)

  const set = (field: keyof CreateForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setForm(prev => {
        const next: Partial<CreateForm> = { [field]: val }
        if (field === 'name') {
          const newSlug = slugify(val)
          next.slug = newSlug
          const autoEmail = prev.slug ? `${prev.slug}-support@getyippie.com` : ''
          if (!prev.inbound_email || prev.inbound_email === autoEmail)
            next.inbound_email = newSlug ? `${newSlug}-support@getyippie.com` : ''
        }
        if (field === 'slug') {
          const safe = slugify(val)
          next.slug = safe
          const autoEmail = prev.slug ? `${prev.slug}-support@getyippie.com` : ''
          if (!prev.inbound_email || prev.inbound_email === autoEmail)
            next.inbound_email = safe ? `${safe}-support@getyippie.com` : ''
        }
        return { ...prev, ...next }
      })
    }

  const toggleModule = (mod: string) =>
    setForm(prev => {
      const next = new Set(prev.enabled_modules)
      next.has(mod) ? next.delete(mod) : next.add(mod)
      return { ...prev, enabled_modules: ALL_MODULES.filter(m => next.has(m)) }
    })

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/admin/tenants', {
        ...form,
        name: form.name.trim(),
        slug: form.slug.trim(),
        admin_email: form.admin_email.trim(),
        admin_full_name: form.admin_full_name.trim() || 'Admin',
        admin_password: form.admin_password.trim() || null,
        logo_url: form.logo_url.trim() || null,
        inbound_email: form.inbound_email.trim() || null,
      }).then((r: any) => r.data),
    onSuccess: (tenant: Tenant) => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      const invites = form.admin_password.trim() ? [] : [form.admin_email.trim()]
      setCreated({ invites: [...invites, ...form.extra_admin_emails], tenant })
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : t('admin_failed_create_client'))
    },
  })

  function stepError(): string {
    if (step === 0) {
      if (!form.name.trim()) return t('admin_company_required')
      if (!form.slug.trim()) return t('admin_slug_required')
      if (slugError) return slugError
      if (!EMAIL_RE.test(form.admin_email.trim())) return t('admin_admin_email_required')
      if (adminEmailError) return adminEmailError
    }
    if (step === 1 && form.enabled_modules.length === 0) return t('admin_modules_required')
    return ''
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    const err = stepError()
    if (err) { setError(err); return }
    setError('')
    if (step < WIZARD_STEPS.length - 1) setStep(step + 1)
    else mutation.mutate()
  }

  function addExtraEmail() {
    const email = extraEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) { setError(t('admin_enter_valid_email')); return }
    if (extraEmailError) { setError(extraEmailError); return }
    if (email === form.admin_email.trim().toLowerCase() || form.extra_admin_emails.includes(email)) {
      setError(t('admin_email_already_list')); return
    }
    setError('')
    setForm(p => ({ ...p, extra_admin_emails: [...p.extra_admin_emails, email] }))
    setExtraEmail('')
  }

  const loginUrl = window.location.origin

  function copyLoginUrl() {
    copyUrl(loginUrl)
  }

  // Domain setup flow inside success screen
  if (dnsViewTenant) {
    return <DnsRecordsModal tenant={dnsViewTenant} onClose={() => setDnsViewTenant(null)} />
  }

  if (domainSetupTenant) {
    return (
      <ProvisionDomainModal
        tenant={domainSetupTenant}
        onClose={() => setDomainSetupTenant(null)}
        onSuccess={(updated) => {
          qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
          setDomainSetupTenant(null)
          setDnsViewTenant(updated)
          if (created) setCreated({ ...created, tenant: updated })
        }}
      />
    )
  }

  if (created) {
    const allInvited = created.invites
    const hasDomain = !!created.tenant.resend_domain_id
    const domainVerified = created.tenant.resend_domain_status === 'verified'
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('admin_client_ready').replace('{name}', form.name)}</h2>
              <p className="text-xs text-slate-400">{t('admin_client_ready_desc')}</p>
            </div>
          </div>
          <div className="p-6 flex flex-col gap-3">
            {/* Invite status */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-700">
                {allInvited.length > 0
                  ? (allInvited.length > 1
                      ? t('admin_invite_sent_multi').replace('{emails}', allInvited.join(', '))
                      : t('admin_invite_sent_one').replace('{emails}', allInvited.join(', ')))
                  : t('admin_admin_ready')
                }
              </div>
            </div>

            {/* Login URL */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <Globe size={14} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 mb-0.5">{t('admin_login_url_label')}</p>
                <p className="text-sm font-mono text-slate-700 truncate">{loginUrl}</p>
              </div>
              <button
                onClick={copyLoginUrl}
                className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title={t('admin_copy_url_title')}
              >
                {copiedLoginUrl ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              </button>
            </div>

            {/* Sending domain */}
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${hasDomain && domainVerified ? 'bg-emerald-50 border-emerald-200' : hasDomain ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
              {hasDomain && domainVerified
                ? <ShieldCheck size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                : hasDomain
                  ? <Globe size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  : <Globe size={14} className="text-slate-300 mt-0.5 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {hasDomain && domainVerified
                    ? t('admin_domain_verified').replace('{domain}', created.tenant.resend_domain_name ?? '')
                    : hasDomain
                      ? t('admin_domain_pending').replace('{domain}', created.tenant.resend_domain_name ?? '')
                      : t('admin_domain_not_set')
                  }
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {hasDomain && domainVerified
                    ? t('admin_domain_verified_desc')
                    : hasDomain
                      ? t('admin_domain_pending_desc')
                      : t('admin_domain_not_set_desc')}
                </p>
              </div>
              {!domainVerified && (
                <button
                  onClick={() => hasDomain ? setDnsViewTenant(created.tenant) : setDomainSetupTenant(created.tenant)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {hasDomain ? t('admin_view_dns_btn') : t('admin_setup_btn')}
                </button>
              )}
            </div>

            {/* Inbound email reminder */}
            {form.inbound_email.trim() && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Inbox size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">{t('admin_inbound_reminder_label')}</p>
                  <p className="text-sm font-mono text-slate-700 truncate">{form.inbound_email.trim()}</p>
                </div>
              </div>
            )}
          </div>
          <div className="px-6 pb-5 flex justify-end">
            <button onClick={onClose} className="px-5 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">{t('admin_done')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{t('admin_new_client_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex items-center gap-1.5 px-6 pt-4 flex-wrap">
          {WIZARD_STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {i < step ? <Check size={11} /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
              {i < WIZARD_STEPS.length - 1 && <div className="w-4 h-px bg-slate-200 mx-0.5" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleNext} className="p-6 flex flex-col gap-4">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('admin_company_name_label')}</label>
                  <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Acme Ltd" autoFocus />
                </div>
                <div>
                  <label className={labelCls}>{t('admin_slug_label')}</label>
                  <input
                    className={`${inputCls} ${slugError ? 'border-red-400 focus:ring-red-400' : form.slug && !slugError ? 'border-emerald-400' : ''}`}
                    value={form.slug}
                    onChange={set('slug')}
                    placeholder="acme-bv"
                  />
                  {slugError
                    ? <p className="mt-1 text-xs text-red-500">{slugError}</p>
                    : form.slug && <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1"><Check size={11} /> {t('admin_slug_available')}</p>
                  }
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('admin_inbound_email_label')}</label>
                <input className={inputCls} type="email" value={form.inbound_email} onChange={set('inbound_email')} placeholder="acme-bv-support@getyippie.com" />
                <p className="mt-1 text-xs text-slate-400">{t('admin_inbound_email_hint')}</p>
              </div>
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('admin_admin_name_label')}</label>
                  <input className={inputCls} value={form.admin_full_name} onChange={set('admin_full_name')} placeholder="Alex Johnson" />
                </div>
                <div>
                  <label className={labelCls}>{t('admin_admin_email_label')}</label>
                  <input
                    className={`${inputCls} ${adminEmailError ? 'border-red-400 focus:ring-red-400' : ''}`}
                    type="email"
                    value={form.admin_email}
                    onChange={set('admin_email')}
                    placeholder="admin@acme.nl"
                  />
                  {adminEmailError && <p className="mt-1 text-xs text-red-500">{adminEmailError}</p>}
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('admin_admin_password_label')}</label>
                <input className={inputCls} type="password" value={form.admin_password} onChange={set('admin_password')} placeholder="••••••••" />
                {form.admin_password.trim()
                  ? <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1"><Check size={11} /> {t('admin_password_set_hint')}</p>
                  : <p className="mt-1 text-xs text-slate-400">{t('admin_password_empty_hint')}</p>
                }
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <label className={labelCls}>{t('admin_enabled_modules_label')}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALL_MODULES.map(mod => (
                  <ModuleToggle key={mod} mod={mod} active={form.enabled_modules.includes(mod)} onClick={() => toggleModule(mod)} />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {t('admin_modules_count_hint').replace('{n}', String(form.enabled_modules.length)).replace('{total}', String(ALL_MODULES.length))}
              </p>
            </div>
          )}

          {step === 2 && (
            <>
              <div>
                <label className={labelCls}>{t('admin_brand_color_label')}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primary_color}
                    onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <span className="text-sm text-slate-500 font-mono">{form.primary_color}</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('admin_logo_url_label')}</label>
                <input className={inputCls} value={form.logo_url} onChange={set('logo_url')} placeholder="https://acme.nl/logo.png" />
                {form.logo_url.trim() && (
                  <img src={form.logo_url.trim()} alt="Logo preview" className="mt-2 h-10 object-contain rounded border border-slate-200 bg-slate-50 p-1" onError={e => (e.currentTarget.style.display = 'none')} />
                )}
                <p className="mt-1 text-xs text-slate-400">{t('admin_logo_url_hint')}</p>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>{t('admin_extra_admins_label')}</label>
                <div className="flex gap-2">
                  <input className={inputCls} type="email" value={extraEmail}
                    onChange={e => setExtraEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExtraEmail() } }}
                    placeholder={t('admin_extra_email_ph')} />
                  <button type="button" onClick={addExtraEmail} className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">{t('admin_add_btn')}</button>
                </div>
                {extraEmailError && <p className="mt-1 text-xs text-red-500">{extraEmailError}</p>}
                <p className="mt-1 text-xs text-slate-400">{t('admin_extra_admins_hint')}</p>
              </div>
              {form.extra_admin_emails.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.extra_admin_emails.map(email => (
                    <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                      {email}
                      <button type="button"
                        onClick={() => setForm(p => ({ ...p, extra_admin_emails: p.extra_admin_emails.filter(e2 => e2 !== email) }))}
                        className="text-blue-400 hover:text-blue-600"><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <>
              {/* Demo vs live choice */}
              <div className="flex flex-col gap-2">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.is_demo ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={form.is_demo} onChange={() => setForm(p => ({ ...p, is_demo: true }))} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{t('admin_start_demo')}</span>
                    <span className="block text-xs text-slate-500">{t('admin_start_demo_desc')}</span>
                  </span>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${!form.is_demo ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={!form.is_demo} onChange={() => setForm(p => ({ ...p, is_demo: false }))} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{t('admin_go_live_now')}</span>
                    <span className="block text-xs text-slate-500">{t('admin_go_live_now_desc')}</span>
                  </span>
                </label>
              </div>

              {/* Full review */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 text-sm overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: form.primary_color }} />
                  <span className="font-semibold text-slate-900">{form.name || '—'}</span>
                  <span className="text-slate-400 font-mono text-xs">/{form.slug}</span>
                </div>
                {form.inbound_email.trim() && (
                  <div className="px-4 py-2 flex gap-2 text-xs">
                    <span className="text-slate-400 w-28 flex-shrink-0">{t('admin_inbound_email_col')}</span>
                    <span className="text-slate-700 font-mono truncate">{form.inbound_email.trim()}</span>
                  </div>
                )}
                <div className="px-4 py-2 flex gap-2 text-xs">
                  <span className="text-slate-400 w-28 flex-shrink-0">{t('admin_modules_col')}</span>
                  <span className="text-slate-700">{form.enabled_modules.map(moduleLabel).join(', ') || '—'}</span>
                </div>
                {form.logo_url.trim() && (
                  <div className="px-4 py-2 flex gap-2 text-xs items-center">
                    <span className="text-slate-400 w-28 flex-shrink-0">{t('admin_logo_col')}</span>
                    <img src={form.logo_url.trim()} alt="" className="h-5 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
                <div className="px-4 py-2 flex gap-2 text-xs">
                  <span className="text-slate-400 w-28 flex-shrink-0">{t('admin_admin_col')}</span>
                  <span className="text-slate-700">
                    {form.admin_full_name.trim() || 'Admin'} &lt;{form.admin_email.trim()}&gt;
                    {form.admin_password.trim() ? t('admin_password_set_col') : t('admin_invite_email_col')}
                  </span>
                </div>
                {form.extra_admin_emails.length > 0 && (
                  <div className="px-4 py-2 flex gap-2 text-xs">
                    <span className="text-slate-400 w-28 flex-shrink-0">{t('admin_extra_admins_col')}</span>
                    <span className="text-slate-700">{form.extra_admin_emails.join(', ')}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            {step > 0 && (
              <button type="button" onClick={() => { setError(''); setStep(step - 1) }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors mr-auto">{t('admin_back_btn')}</button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{t('admin_cancel')}</button>
            <button type="submit" disabled={mutation.isPending || (step === 0 && !!slugError)} className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed">
              {step < WIZARD_STEPS.length - 1 ? t('admin_next_btn') : mutation.isPending ? t('admin_creating') : t('admin_create_client_btn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type EditTab = 'info' | 'modules' | 'branding' | 'whatsapp' | 'users' | 'actions' | 'developer_tools'

function EditClientModal({
  tenant,
  onClose,
  togglingActive,
  onToggleActive,
  onCopyEmail,
  copied,
  onRequestDelete,
  onGoLive,
  goingLive,
  isOwnTenant,
  defaultTab,
}: {
  tenant: Tenant
  onClose: () => void
  togglingActive: boolean
  onToggleActive: () => void
  onCopyEmail: () => void
  copied: boolean
  onRequestDelete: () => void
  onGoLive?: () => void
  goingLive?: boolean
  isOwnTenant?: boolean
  defaultTab?: EditTab
}) {
  const t = useT()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isRootOwner = user?.is_root_owner ?? false
  const [tab, setTab] = useState<EditTab>(defaultTab ?? 'info')
  const [form, setForm] = useState({
    name: tenant.name,
    inbound_email: tenant.inbound_email ?? '',
    kvk_nummer: tenant.kvk_nummer ?? '',
    btw_nummer: tenant.btw_nummer ?? '',
    street_address: tenant.street_address ?? '',
    postal_code: tenant.postal_code ?? '',
    city: tenant.city ?? '',
    country: tenant.country ?? 'Nederland',
    iban: tenant.iban ?? '',
    phone: tenant.phone ?? '',
    enabled_modules: ALL_MODULES.filter(m => tenant.enabled_modules.includes(m)),
    plan: tenant.plan,
    primary_color: tenant.primary_color,
    logo_url: tenant.logo_url ?? '',
    whatsapp_phone_number_id: tenant.whatsapp_phone_number_id ?? '',
    whatsapp_access_token: tenant.whatsapp_access_token ?? '',
    whatsapp_verify_token: tenant.whatsapp_verify_token ?? '',
    ai_auto_scan: tenant.ai_auto_scan ?? false,
    demo_days_remaining: demoDaysRemaining(tenant.demo_expires_at),
    lead_widget_save_contact: tenant.lead_widget_save_contact ?? true,
    lead_widget_stage_id: tenant.lead_widget_stage_id ?? null,
  })
  const [error, setError] = useState('')
  const [showAddAdmin, setShowAddAdmin] = useState(false)
  const { copy: copyEmbed, copied: embedCopied } = useCopy({ useToast: false })

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch(`/admin/tenants/${tenant.id}`, patch).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: () => setError(t('admin_failed_save')),
  })

  const { data: usersData, isLoading: usersLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users', tenant.id],
    queryFn: () => api.get(`/admin/tenants/${tenant.id}/users`).then((r: any) => r.data),
    enabled: tab === 'users',
  })

  const { data: pipelineStages } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['tenant-pipeline-stages', tenant.id],
    queryFn: () => api.get(`/admin/tenants/${tenant.id}/pipeline-stages`).then((r: any) => r.data),
    enabled: tab === 'developer_tools',
  })

  const toggleUserMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      api.patch(`/admin/tenants/${tenant.id}/users/${userId}`, { is_active }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-users', tenant.id] }),
  })

  function handleSave() {
    const patch: Record<string, unknown> = {}
    if (form.name.trim() && form.name.trim() !== tenant.name) patch.name = form.name.trim()
    const inbound = form.inbound_email.trim() || null
    if (inbound !== tenant.inbound_email) patch.inbound_email = inbound
    const kvk = form.kvk_nummer.trim() || null
    if (kvk !== tenant.kvk_nummer) patch.kvk_nummer = kvk
    const btw = form.btw_nummer.trim() || null
    if (btw !== tenant.btw_nummer) patch.btw_nummer = btw
    const street = form.street_address.trim() || null
    if (street !== tenant.street_address) patch.street_address = street
    const postal = form.postal_code.trim() || null
    if (postal !== tenant.postal_code) patch.postal_code = postal
    const city = form.city.trim() || null
    if (city !== tenant.city) patch.city = city
    const country = form.country.trim() || null
    if (country !== tenant.country) patch.country = country
    const iban = form.iban.trim() || null
    if (iban !== tenant.iban) patch.iban = iban
    const phone = form.phone.trim() || null
    if (phone !== tenant.phone) patch.phone = phone
    const newMods = JSON.stringify([...form.enabled_modules].sort())
    const oldMods = JSON.stringify([...tenant.enabled_modules].sort())
    if (newMods !== oldMods) patch.enabled_modules = form.enabled_modules
    if (form.plan !== tenant.plan) patch.plan = form.plan
    if (form.primary_color !== tenant.primary_color) patch.primary_color = form.primary_color
    const logo = form.logo_url.trim() || null
    if (logo !== tenant.logo_url) patch.logo_url = logo
    const waPhone = form.whatsapp_phone_number_id.trim() || null
    if (waPhone !== tenant.whatsapp_phone_number_id) patch.whatsapp_phone_number_id = waPhone
    const waToken = form.whatsapp_access_token.trim() || null
    if (waToken !== tenant.whatsapp_access_token) patch.whatsapp_access_token = waToken
    const waVerify = form.whatsapp_verify_token.trim() || null
    if (waVerify !== tenant.whatsapp_verify_token) patch.whatsapp_verify_token = waVerify
    if (form.ai_auto_scan !== tenant.ai_auto_scan) patch.ai_auto_scan = form.ai_auto_scan
    if (form.lead_widget_save_contact !== (tenant.lead_widget_save_contact ?? true)) patch.lead_widget_save_contact = form.lead_widget_save_contact
    if (form.lead_widget_stage_id !== (tenant.lead_widget_stage_id ?? null)) patch.lead_widget_stage_id = form.lead_widget_stage_id
    if (tenant.is_demo && form.demo_days_remaining !== demoDaysRemaining(tenant.demo_expires_at)) {
      const days = Math.max(1, Math.min(365, form.demo_days_remaining))
      const expires = new Date()
      expires.setDate(expires.getDate() + days)
      patch.demo_expires_at = expires.toISOString()
    }
    if (Object.keys(patch).length === 0) { onClose(); return }
    setError('')
    mutation.mutate(patch)
  }

  const TABS: { key: EditTab; label: string }[] = [
    { key: 'info', label: t('admin_tab_info') },
    { key: 'modules', label: t('admin_tab_modules') },
    { key: 'branding', label: t('admin_tab_branding') },
    { key: 'whatsapp', label: t('admin_tab_whatsapp') },
    { key: 'users', label: t('admin_tab_users') },
    { key: 'actions', label: t('admin_tab_actions') },
    { key: 'developer_tools', label: t('admin_tab_developer_tools') },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('admin_edit_client_title')}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex border-b border-slate-100 px-6 shrink-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {tab === 'info' && (
            <>
              <div>
                <label className={labelCls}>{t('admin_company_name_field')}</label>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={tenant.name}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>{t('admin_inbound_email_field')}</label>
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    type="email"
                    value={form.inbound_email}
                    onChange={e => setForm(p => ({ ...p, inbound_email: e.target.value }))}
                    placeholder={`${tenant.slug}-support@getyippie.com`}
                  />
                  {tenant.inbound_email && (
                    <button type="button" onClick={onCopyEmail}
                      className="px-3 py-2 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
                      title={t('admin_copy_inbound')}
                    >
                      {copied ? <Check size={13} className="text-emerald-500" /> : <Clipboard size={13} />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">{t('admin_inbound_email_field_hint')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('admin_slug_field')}</label>
                <input className={`${inputCls} opacity-50 cursor-not-allowed`} value={tenant.slug} disabled />
                <p className="mt-1 text-xs text-slate-400">{t('admin_slug_cannot_change')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('admin_plan_field')}</label>
                <select
                  className={inputCls}
                  value={form.plan}
                  onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                >
                  {PLAN_TIERS.map(p => (
                    <option key={p} value={p}>{planLabel(p)}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">{t('admin_plan_hint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('admin_kvk_label')}</label>
                  <input
                    className={inputCls}
                    value={form.kvk_nummer}
                    onChange={e => setForm(p => ({ ...p, kvk_nummer: e.target.value }))}
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('admin_btw_label')}</label>
                  <input
                    className={inputCls}
                    value={form.btw_nummer}
                    onChange={e => setForm(p => ({ ...p, btw_nummer: e.target.value }))}
                    placeholder="NL123456789B01"
                  />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mt-1">{t('admin_invoice_address')}</p>
              <div>
                <label className={labelCls}>{t('admin_street_label')}</label>
                <input className={inputCls} value={form.street_address}
                  onChange={e => setForm(p => ({ ...p, street_address: e.target.value }))}
                  placeholder="Keizersgracht 123" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('admin_postal_label')}</label>
                  <input className={inputCls} value={form.postal_code}
                    onChange={e => setForm(p => ({ ...p, postal_code: e.target.value }))}
                    placeholder="1234 AB" />
                </div>
                <div>
                  <label className={labelCls}>{t('admin_city_label')}</label>
                  <input className={inputCls} value={form.city}
                    onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                    placeholder="Amsterdam" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('admin_country_label')}</label>
                  <input className={inputCls} value={form.country}
                    onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                    placeholder="Nederland" />
                </div>
                <div>
                  <label className={labelCls}>{t('admin_phone_label')}</label>
                  <input className={inputCls} value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+31 20 123 4567" />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('admin_iban_label')}</label>
                <input className={inputCls} value={form.iban}
                  onChange={e => setForm(p => ({ ...p, iban: e.target.value }))}
                  placeholder="NL12 BANK 0123 4567 89" />
                <p className="mt-1 text-xs text-slate-400">{t('admin_iban_hint')}</p>
              </div>
              {tenant.is_demo && (
                <div>
                  <label className={labelCls}>{t('admin_demo_days_label')}</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className={inputCls}
                    value={form.demo_days_remaining}
                    onChange={e => setForm(p => ({
                      ...p,
                      demo_days_remaining: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {t('admin_demo_days_hint')}
                    {tenant.demo_expires_at && (
                      <> {t('admin_current_expiry')} {new Date(tenant.demo_expires_at).toLocaleDateString()}.</>
                    )}
                  </p>
                </div>
              )}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.ai_auto_scan}
                  onChange={e => setForm(p => ({ ...p, ai_auto_scan: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{t('admin_ai_auto_scan_label')}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {t('admin_ai_auto_scan_hint')}
                  </span>
                </span>
              </label>
            </>
          )}

          {tab === 'modules' && (
            <div>
              <label className={labelCls}>Enabled modules</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALL_MODULES.map(mod => (
                  <ModuleToggle
                    key={mod}
                    mod={mod}
                    active={form.enabled_modules.includes(mod)}
                    onClick={() =>
                      setForm(prev => {
                        const next = new Set(prev.enabled_modules)
                        next.has(mod) ? next.delete(mod) : next.add(mod)
                        return { ...prev, enabled_modules: ALL_MODULES.filter(m => next.has(m)) }
                      })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'branding' && (
            <>
              <div>
                <label className={labelCls}>{t('admin_brand_color_label')}</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <span className="text-sm text-slate-500 font-mono">{form.primary_color}</span>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, primary_color: '#5BA4F5' }))}
                    className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    {t('admin_reset_to_default')}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('admin_logo_url_label')}</label>
                <input
                  className={inputCls}
                  value={form.logo_url}
                  onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://company.nl/logo.png"
                />
                <p className="mt-1 text-xs text-slate-400">{t('admin_logo_hint')}</p>
              </div>
              {(form.logo_url || form.primary_color !== tenant.primary_color) && (
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
                  <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: form.primary_color }} />
                  {form.logo_url ? (
                    <img
                      src={form.logo_url}
                      alt="Logo preview"
                      className="h-7 object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <span className="text-xs font-bold" style={{ color: form.primary_color }}>Preview</span>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'whatsapp' && (
            <>
              <p className="text-xs text-slate-400 -mt-1 mb-1">
                {t('admin_wa_credentials_desc')}
                {' '}Webhook URL to register in Meta: <span className="font-mono">https://app.getyippie.com/api/v1/chat/webhooks/{tenant.slug}/whatsapp</span>
              </p>
              <div>
                <label className={labelCls}>{t('admin_wa_phone_id_label')}</label>
                <input
                  className={inputCls}
                  value={form.whatsapp_phone_number_id}
                  onChange={e => setForm(p => ({ ...p, whatsapp_phone_number_id: e.target.value }))}
                  placeholder="123456789012345"
                />
                <p className="mt-1 text-xs text-slate-400">{t('admin_wa_phone_id_hint')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('admin_wa_access_token_label')}</label>
                <input
                  className={inputCls}
                  type="password"
                  value={form.whatsapp_access_token}
                  onChange={e => setForm(p => ({ ...p, whatsapp_access_token: e.target.value }))}
                  placeholder="EAAxxxxx…"
                />
                <p className="mt-1 text-xs text-slate-400">{t('admin_wa_access_token_hint')}</p>
              </div>
              <div>
                <label className={labelCls}>{t('admin_wa_verify_token_label')}</label>
                <input
                  className={inputCls}
                  value={form.whatsapp_verify_token}
                  onChange={e => setForm(p => ({ ...p, whatsapp_verify_token: e.target.value }))}
                  placeholder="any-secret-string-you-choose"
                />
                <p className="mt-1 text-xs text-slate-400">{t('admin_wa_verify_token_hint')}</p>
              </div>
            </>
          )}

          {tab === 'users' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_team_members')}</span>
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <UserPlus size={12} />
                  {t('admin_add_admin_btn')}
                </button>
              </div>
              {usersLoading && <p className="text-sm text-slate-400">{t('admin_users_loading')}</p>}
              {usersData && usersData.length === 0 && <p className="text-sm text-slate-400">{t('admin_no_users')}</p>}
              {usersData && usersData.length > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {usersData.map((u: any) => (
                    <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${!u.is_active ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{u.full_name}</div>
                        <div className="text-xs text-slate-400 truncate">{u.email}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${ROLE_STYLES[u.role] ?? ROLE_STYLES.viewer}`}>{u.role}</span>
                      <button
                        type="button"
                        onClick={() => toggleUserMutation.mutate({ userId: u.id, is_active: !u.is_active })}
                        disabled={toggleUserMutation.isPending || u.role === 'superadmin'}
                        className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={u.role === 'superadmin' ? t('admin_superadmin_no_deactivate') : u.is_active ? t('admin_deactivate_user') : t('admin_activate_user')}
                      >
                        {u.is_active
                          ? <ToggleRight size={16} className="text-emerald-500" />
                          : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'actions' && (
            <div className="flex flex-col gap-4">
              {isOwnTenant ? (
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <Lock size={14} className="text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-500">{t('admin_own_env_locked')}</p>
                </div>
              ) : (
                <>
                  {tenant.is_demo && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">{t('admin_go_live_label')}</p>
                        <p className="text-xs text-slate-400">{t('admin_go_live_desc')}</p>
                      </div>
                      <button
                        onClick={() => { onGoLive?.(); onClose() }}
                        disabled={goingLive}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      >
                        <Rocket size={13} />
                        {t('admin_go_live_btn')}
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{tenant.is_active ? t('admin_active_label') : t('admin_inactive_label')}</p>
                      <p className="text-xs text-slate-400">{tenant.is_active ? t('admin_active_desc') : t('admin_inactive_desc')}</p>
                    </div>
                    <button
                      onClick={() => { onToggleActive(); onClose() }}
                      disabled={togglingActive}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      {tenant.is_active
                        ? <><ToggleRight size={14} className="text-emerald-500" /> {t('admin_deactivate_user')}</>
                        : <><ToggleLeft size={14} className="text-slate-400" /> {t('admin_activate_user')}</>}
                    </button>
                  </div>

                  {isRootOwner && (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-sm font-semibold text-red-600">{t('admin_delete_client_label')}</p>
                        <p className="text-xs text-slate-400">{t('admin_delete_client_desc')}</p>
                      </div>
                      <button
                        onClick={onRequestDelete}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                        {t('admin_delete_btn')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === 'developer_tools' && (
            <div className="flex flex-col gap-5">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.lead_widget_save_contact}
                  onChange={e => setForm(p => ({ ...p, lead_widget_save_contact: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-800">{t('admin_save_contacts_label')}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {t('admin_save_contacts_hint')}
                  </span>
                </span>
              </label>

              {form.lead_widget_save_contact && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('admin_pipeline_stage_label')}</label>
                  <select
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                    value={form.lead_widget_stage_id ?? ''}
                    onChange={e => setForm(p => ({ ...p, lead_widget_stage_id: e.target.value || null }))}
                  >
                    <option value="">{t('admin_pipeline_none')}</option>
                    {(pipelineStages ?? []).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-400">{t('admin_pipeline_stage_hint')}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{t('admin_lead_widget_label')}</label>
                <p className="text-xs text-slate-400 mb-2">{t('admin_lead_widget_hint')}</p>
                <div className="flex items-start gap-2">
                  <pre className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono text-slate-700">{`<script src="https://app.getyippie.com/lead-widget.js" data-tenant="${tenant.slug}"></script>`}</pre>
                  <button
                    type="button"
                    onClick={() => copyEmbed(`<script src="https://app.getyippie.com/lead-widget.js" data-tenant="${tenant.slug}"></script>`)}
                    className="shrink-0 px-3 py-2 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    title={t('admin_copy_embed')}
                  >
                    {embedCopied ? <Check size={13} className="text-emerald-500" /> : <Clipboard size={13} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className={`flex gap-3 pt-2 ${tab === 'actions' || tab === 'users' ? 'justify-center' : 'justify-end'}`}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {tab === 'actions' || tab === 'users' ? t('admin_close') : t('admin_cancel')}
            </button>
            {tab !== 'actions' && tab !== 'users' && (
              <button
                onClick={handleSave}
                disabled={mutation.isPending}
                className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed"
              >
                {mutation.isPending ? t('admin_saving') : t('admin_save_changes')}
              </button>
            )}
          </div>
        </div>
      </div>
      {showAddAdmin && <AddAdminModal tenant={tenant} onClose={() => { setShowAddAdmin(false); qc.invalidateQueries({ queryKey: ['tenant-users', tenant.id] }) }} />}
    </div>
  )
}

function DeleteClientModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post(`/admin/tenants/${tenant.id}/delete`, { current_password: password }).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : t('admin_failed_delete_client'))
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
          <div>
            <h2 className="text-lg font-bold text-red-600">{t('admin_delete_client_title')}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700">
              {t('admin_delete_client_body').replace('{name}', tenant.name)}
            </p>
          </div>
          <div>
            <label className={labelCls}>{t('admin_your_password')}</label>
            <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('admin_confirm_password_ph')} autoFocus />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{t('admin_cancel')}</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? t('admin_deleting') : t('admin_delete_forever')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddAdminModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [form, setForm] = useState({ email: '', password: '', full_name: 'Admin' })
  const [error, setError] = useState('')
  const [invited, setInvited] = useState<string | null>(null)
  const emailError = useEmailCheckError(form.email, t)

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/tenants/${tenant.id}/users`, {
        ...form,
        email: form.email.trim(),
        password: form.password.trim() || null,
      }).then((r: any) => r.data),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      qc.invalidateQueries({ queryKey: ['tenant-users', tenant.id] })
      if (data?.invited) setInvited(data.email)
      else onClose()
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : t('admin_failed_add_admin'))
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(form.email.trim())) { setError(t('admin_valid_email_required')); return }
    if (emailError) { setError(emailError); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('admin_add_admin_title')}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        {invited ? (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-emerald-600 font-medium">
              {t('admin_admin_invite_sent').replace('{email}', invited)}
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity">{t('admin_done')}</button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>{t('admin_full_name_label')}</label>
            <input className={inputCls} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Admin" />
          </div>
          <div>
            <label className={labelCls}>{t('admin_email_label')}</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="admin@company.nl" autoFocus />
            {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
          </div>
          <div>
            <label className={labelCls}>{t('admin_admin_password_field')}</label>
            <input className={inputCls} type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
            <p className="mt-1 text-xs text-slate-400">{t('admin_admin_password_hint')}</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{t('admin_cancel')}</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity disabled:cursor-not-allowed">
              {mutation.isPending ? t('admin_adding') : form.password.trim() ? t('admin_add_admin_submit') : t('admin_send_invite')}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

function BulkDeleteClientsModal({ tenants, onClose }: { tenants: Tenant[]; onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        tenants.map(tenant => api.post(`/admin/tenants/${tenant.id}/delete`, { current_password: password }))
      )
      const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[]
      if (failures.length > 0) {
        const first = (failures[0].reason as any)?.response?.data?.detail
        const msg = typeof first === 'string' ? first : 'Delete failed'
        throw new Error(failures.length === tenants.length
          ? msg
          : `${tenants.length - failures.length} of ${tenants.length} deleted. Errors: ${msg}`)
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: (err: any) => {
      setError(err.message ?? t('admin_failed_delete'))
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
          <div>
            <h2 className="text-lg font-bold text-red-600">
              {tenants.length !== 1
                ? t('admin_bulk_delete_title_pl').replace('{n}', String(tenants.length))
                : t('admin_bulk_delete_title').replace('{n}', String(tenants.length))}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">{t('admin_bulk_cannot_undo')}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-32 overflow-y-auto">
            {tenants.map(tenant => (
              <p key={tenant.id} className="text-sm text-red-700">
                {t('admin_bulk_wipe_desc').replace('{name}', tenant.name)}
              </p>
            ))}
          </div>
          <div>
            <label className={labelCls}>{t('admin_your_password')}</label>
            <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('admin_confirm_password_ph')} autoFocus />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{t('admin_cancel')}</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? t('admin_deleting') : t('admin_delete_forever')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function TenantUsersModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const t = useT()
  const { data, isLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users', tenant.id],
    queryFn: () => api.get(`/admin/tenants/${tenant.id}/users`).then((r: any) => r.data),
  })

  function fmtLastActive(val: string | null): string {
    if (!val) return '—'
    const d = new Date(val)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 2) return t('admin_users_just_now')
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t('admin_users_modal_title')}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-6">
          {isLoading && <p className="text-sm text-slate-400">{t('admin_loading')}</p>}
          {!isLoading && (!data || data.length === 0) && (
            <p className="text-sm text-slate-400">{t('admin_users_no_users')}</p>
          )}
          {data && data.length > 0 && (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>{t('admin_users_col_name_email')}</span>
                <span>{t('admin_users_col_role')}</span>
                <span>{t('admin_users_col_last_active')}</span>
                <span>{t('admin_col_status')}</span>
              </div>
              {data.map((u: any) => (
                <div key={u.id} className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 ${!u.is_active ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{u.full_name}</div>
                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${ROLE_STYLES[u.role] ?? ROLE_STYLES.viewer}`}>{u.role}</span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{fmtLastActive(u.last_login_at)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.is_active ? t('admin_status_active') : t('admin_status_inactive')}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              {t('admin_close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EvolutionDiagnosticPanel() {
  const t = useT()
  const [result, setResult] = useState<any>(null)
  const [sendResult, setSendResult] = useState<any>(null)
  const { copy: copyJson, copied } = useCopy({ useToast: false })
  const [testNumber, setTestNumber] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.get('/admin/evolution-check').then((r: any) => r.data),
    onSuccess: (data: any) => setResult(data),
  })

  const sendMutation = useMutation({
    mutationFn: () => api.post('/admin/evolution-send-test', {
      number: testNumber.trim(),
      message: 'Yippie diagnostics test',
      instance: 'default',
    }).then((r: any) => r.data),
    onSuccess: (data: any) => setSendResult(data),
  })

  function copyAll() {
    const all = {
      ...(result ? { check: result } : {}),
      ...(sendResult ? { send_test: sendResult } : {}),
    }
    copyJson(JSON.stringify(all, null, 2))
  }

  const combined = result || sendResult

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <FlaskConical size={14} className="text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 flex-1">{t('admin_evolution_diag')}</span>
        {combined && (
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Clipboard size={12} />}
            {copied ? t('admin_copied') : t('admin_copy_all')}
          </button>
        )}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {mutation.isPending ? t('admin_checking') : t('admin_run_check')}
        </button>
      </div>
      {/* Test send row */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-slate-100">
        <span className="text-xs text-slate-500 shrink-0">{t('admin_test_send_to')}</span>
        <input
          value={testNumber}
          onChange={e => setTestNumber(e.target.value)}
          placeholder="31612345678 or 120022928212099@lid"
          className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending || !testNumber.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {sendMutation.isPending ? t('admin_sending_test') : t('admin_send_test')}
        </button>
      </div>
      {(result || sendResult) && (
        <pre className="border-t border-slate-100 bg-slate-50 rounded-b-xl px-4 py-3 text-xs text-slate-700 overflow-auto max-h-64 whitespace-pre-wrap">
          {JSON.stringify(
            {
              ...(result ? { check: result } : {}),
              ...(sendResult ? { send_test: sendResult } : {}),
            },
            null,
            2
          )}
        </pre>
      )}
    </div>
  )
}

function ResendDiagnosticPanel() {
  const t = useT()
  const [result, setResult] = useState<any>(null)
  const { copy: copyJson, copied } = useCopy({ useToast: false })

  const mutation = useMutation({
    mutationFn: () => api.get('/admin/resend-check').then((r: any) => r.data),
    onSuccess: (data: any) => setResult(data),
  })

  function copyAll() {
    copyJson(JSON.stringify(result, null, 2))
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <FlaskConical size={14} className="text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 flex-1">{t('admin_resend_diag')}</span>
        {result && (
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Clipboard size={12} />}
            {copied ? t('admin_copied') : t('admin_copy_all')}
          </button>
        )}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {mutation.isPending ? t('admin_checking') : t('admin_run_check')}
        </button>
      </div>
      {result && (
        <pre className="border-t border-slate-100 bg-slate-50 rounded-b-xl px-4 py-3 text-xs text-slate-700 overflow-auto max-h-64 whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}

interface TenantStatRow {
  tenant_id: string
  name: string
  slug: string
  plan: string
  is_active: boolean
  tickets_open: number
  tickets_closed: number
  tickets_overdue: number
  inbox_pending: number
  contacts_created: number
  active_users_today: number
  ai_usage_today: number
  ai_usage_period: number
  saas_events_period: number
}

interface SuperAdminStats {
  summary: {
    total_tenants: number
    active_tenants: number
    total_tickets_open: number
    total_tickets_overdue: number
    total_inbox_pending: number
    total_ai_usage_today: number
    total_contacts_created: number
  }
  tenants: TenantStatRow[]
  start: string
  end: string
}

type DateRange = '7d' | '30d' | 'all'

// RANGE_TABS labels are built inside DashboardTab using t() to avoid top-level hook calls

function DnsRecordsModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const t = useT()
  const [copied, setCopied] = useState<string | null>(null)
  const { copy: copyDns } = useCopy({ useToast: false, successMessage: 'Copied' })

  function copyValue(key: string, value: string) {
    copyDns(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const records = tenant.resend_domain_records ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('admin_dns_title').replace('{domain}', tenant.resend_domain_name ?? '')}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{t('admin_dns_desc')}</p>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-6 flex flex-col gap-3">
          {records.length === 0 && (
            <p className="text-sm text-slate-400">{t('admin_dns_no_records')}</p>
          )}
          {records.map((rec, i) => {
            const copyKey = `${i}-name`
            const valueKey = `${i}-value`
            return (
              <div key={i} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded">{rec.record}</span>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded">{rec.type}</span>
                  {rec.status === 'verified' && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-semibold rounded flex items-center gap-1">
                      <ShieldCheck size={10} /> {t('admin_dns_verified')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-[80px_1fr_32px] items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">{t('admin_dns_col_name')}</span>
                  <code className="bg-slate-50 px-2 py-1 rounded text-slate-700 font-mono truncate">{rec.name}</code>
                  <button
                    onClick={() => copyValue(copyKey, rec.name)}
                    className="text-slate-400 hover:text-blue-600 transition-colors"
                    title={t('admin_dns_copy_name')}
                  >
                    {copied === copyKey ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="grid grid-cols-[80px_1fr_32px] items-start gap-2 text-xs">
                  <span className="text-slate-400 font-medium pt-1">{t('admin_dns_col_value')}</span>
                  <code className="bg-slate-50 px-2 py-1 rounded text-slate-700 font-mono break-all">{rec.value}</code>
                  <button
                    onClick={() => copyValue(valueKey, rec.value)}
                    className="text-slate-400 hover:text-blue-600 transition-colors pt-1"
                    title={t('admin_dns_copy_value')}
                  >
                    {copied === valueKey ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
                {rec.priority != null && (
                  <div className="grid grid-cols-[80px_1fr] gap-2 text-xs">
                    <span className="text-slate-400 font-medium">{t('admin_dns_col_priority')}</span>
                    <span className="text-slate-600">{rec.priority}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ProvisionDomainModal({ tenant, onClose, onSuccess }: {
  tenant: Tenant
  onClose: () => void
  onSuccess: (updated: Tenant) => void
}) {
  const t = useT()
  const [domain, setDomain] = useState(
    tenant.inbound_email ? tenant.inbound_email.split('@')[1] ?? '' : ''
  )
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => api.post(`/admin/tenants/${tenant.id}/resend-domain`, { domain }).then((r: any) => r.data),
    onSuccess: (data: any) => onSuccess(data),
    onError: (e: any) => setError(e?.response?.data?.detail ?? t('admin_failed_provision')),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-900">{t('admin_provision_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="p-6 flex flex-col gap-4">
          <p className="text-sm text-slate-500">
            {t('admin_provision_desc')}
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('admin_domain_name_label')}</label>
            <input
              value={domain}
              onChange={e => { setDomain(e.target.value); setError(null) }}
              placeholder="acme.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30"
              onKeyDown={e => e.key === 'Enter' && !mutation.isPending && domain.trim() && mutation.mutate()}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
              {t('admin_cancel')}
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !domain.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-yippie rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? t('admin_registering') : t('admin_register_domain')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function rangeStart(range: DateRange): string | undefined {
  if (range === 'all') return undefined
  const d = new Date()
  d.setDate(d.getDate() - (range === '7d' ? 7 : 30))
  return d.toISOString()
}

function StatCard({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: number; tone?: 'red' | 'amber' | 'default'
}) {
  const toneCls =
    tone === 'red' ? 'text-red-600' :
    tone === 'amber' ? 'text-amber-600' :
    'text-slate-900'
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-bold leading-tight ${toneCls}`}>{value}</div>
        <div className="text-xs text-slate-400 font-medium truncate">{label}</div>
      </div>
    </div>
  )
}

function DashboardTab({ tenants }: { tenants: Tenant[] }) {
  const t = useT()
  const [range, setRange] = useState<DateRange>('7d')
  const [tenantFilter, setTenantFilter] = useState<string>('')

  const RANGE_TABS: { key: DateRange; label: string }[] = [
    { key: '7d', label: t('admin_range_7d') },
    { key: '30d', label: t('admin_range_30d') },
    { key: 'all', label: t('admin_range_all') },
  ]

  const params: Record<string, string> = {}
  const start = rangeStart(range)
  if (start) params.start = start
  if (tenantFilter) params.tenant_id = tenantFilter

  const { data, isLoading } = useQuery<SuperAdminStats>({
    queryKey: ['superadmin-stats', range, tenantFilter],
    queryFn: () => api.get('/admin/stats', { params }).then((r: any) => r.data),
    refetchInterval: 60_000,
  })

  const summary = data?.summary
  const rows = data?.tenants ?? []

  return (
    <div className="flex flex-col gap-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {RANGE_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                range === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={tenantFilter}
          onChange={e => setTenantFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          <option value="">{t('admin_all_tenants')}</option>
          {tenants.map(tenant => (
            <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
          ))}
        </select>
        {tenantFilter && (
          <button onClick={() => setTenantFilter('')} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
            {t('admin_clear_filter')}
          </button>
        )}
        <span className="text-xs text-slate-300 ml-auto">{t('admin_auto_refresh')}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard icon={<Building2 size={16} />} label={t('admin_stat_total_tenants')} value={summary?.total_tenants ?? 0} />
        <StatCard icon={<Check size={16} />} label={t('admin_stat_active_tenants')} value={summary?.active_tenants ?? 0} />
        <StatCard icon={<TicketIcon size={16} />} label={t('admin_stat_open_tickets')} value={summary?.total_tickets_open ?? 0} />
        <StatCard icon={<AlertTriangle size={16} />} label={t('admin_stat_overdue_tickets')} value={summary?.total_tickets_overdue ?? 0} tone={summary && summary.total_tickets_overdue > 0 ? 'red' : 'default'} />
        <StatCard icon={<Inbox size={16} />} label={t('admin_stat_inbox_pending')} value={summary?.total_inbox_pending ?? 0} />
        <StatCard icon={<Globe size={16} />} label={t('admin_stat_saas_events').replace('{range}', range)} value={rows.reduce((s: any, row: any) => s + row.saas_events_period, 0)} />
      </div>

      {isLoading && <p className="text-sm text-slate-400">{t('admin_loading')}</p>}

      {!isLoading && rows.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <LayoutDashboard size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">{t('admin_no_tenant_activity')}</p>
        </div>
      )}

      {/* Per-tenant table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Tenant</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin_table_open')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin_table_overdue')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin_table_inbox_pending')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin_table_ai_today')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin_table_contacts')} ({range === 'all' ? 'all' : range === '7d' ? '7d' : '30d'})</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">{t('admin_table_saas_events')} ({range === 'all' ? 'all' : range})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r: any) => {
                const overdue = r.tickets_overdue > 0
                const atRisk = r.ai_usage_today === 0 && r.tickets_overdue > 2
                const rowCls = overdue ? 'bg-red-50/60 hover:bg-red-50' : atRisk ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50'
                return (
                  <tr
                    key={r.tenant_id}
                    onClick={() => setTenantFilter(prev => prev === r.tenant_id ? '' : r.tenant_id)}
                    className={`cursor-pointer transition-colors ${rowCls} ${tenantFilter === r.tenant_id ? 'ring-1 ring-inset ring-blue-300' : ''} ${!r.is_active ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-400">{r.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{r.tickets_open}</td>
                    <td className={`px-4 py-3 text-right text-sm font-semibold tabular-nums ${overdue ? 'text-red-600' : 'text-slate-400'}`}>{r.tickets_overdue}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{r.inbox_pending}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      <span className={`inline-flex items-center gap-1 ${r.ai_usage_today > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                        {r.ai_usage_today > 0 && <Sparkles size={11} className="text-violet-400" />}
                        {r.ai_usage_today}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 tabular-nums">{r.contacts_created}</td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      <span className={r.saas_events_period > 0 ? 'text-slate-700' : 'text-slate-300'}>
                        {r.saas_events_period}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SuperAdminPage() {
  const t = useT()
  const qc = useQueryClient()
  const config = useTenantConfig()
  const navigate = useNavigate()
  const { user, startImpersonation } = useAuth()
  const isRootOwner = user?.is_root_owner ?? false
  const { copy: copyEmail } = useCopy({ useToast: false })
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [editingTab, setEditingTab] = useState<EditTab | undefined>(undefined)
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null)
  const [bulkDeletingTenants, setBulkDeletingTenants] = useState<Tenant[] | null>(null)
  const [viewingUsersTenant, setViewingUsersTenant] = useState<Tenant | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [pageTab, setPageTab] = useState<'dashboard' | 'clients'>('clients')
  const [dnsModalTenant, setDnsModalTenant] = useState<Tenant | null>(null)
  const [provisionModalTenant, setProvisionModalTenant] = useState<Tenant | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  const { data: allTenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => api.get('/admin/tenants').then((r: any) => r.data),
  })

  const monthStart = useMemo(() => {
    const d = new Date()
    d.setDate(1); d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const { data: monthlyStats } = useQuery<SuperAdminStats>({
    queryKey: ['superadmin-stats-month', monthStart],
    queryFn: () => api.get('/admin/stats', { params: { start: monthStart } }).then((r: any) => r.data),
    staleTime: 300_000,
  })

  const aiUsageByTenant = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of monthlyStats?.tenants ?? []) {
      map[String(row.tenant_id)] = row.ai_usage_period
    }
    return map
  }, [monthlyStats])

  const ownSlug = config?.tenant_id
  const isOwnTenant = (t: Tenant) => !!ownSlug && t.slug === ownSlug
  const tenants = (allTenants ?? [])

  const counts = {
    all: tenants.length,
    active: tenants.filter((t: any) => statusOf(t) === 'active').length,
    demo: tenants.filter((t: any) => statusOf(t) === 'demo').length,
    inactive: tenants.filter((t: any) => statusOf(t) === 'inactive').length,
  }

  const visible = filter === 'all' ? tenants : tenants.filter((t: any) => statusOf(t) === filter)

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/tenants/${id}`, { is_active }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  const goLiveMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/tenants/${id}`, { is_demo: false, go_live_at: new Date().toISOString() }).then((r: any) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  const verifyDomainMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/tenants/${id}/resend-domain/verify`).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); setVerifyingId(null) },
    onError: () => setVerifyingId(null),
  })

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/tenants/${id}/impersonate`).then((r: any) => ({ ...r.data, tenantId: id })),
    onSuccess: async (data: any) => {
      await startImpersonation(data.tenantId, data.impersonated_tenant_name, data.impersonated_user_email)
      navigate('/')
    },
  })

  const bulkMutation = useMutation({
    mutationFn: async (patch: { is_active?: boolean; is_demo?: boolean }) => {
      await Promise.all([...selectedIds].map(id => api.patch(`/admin/tenants/${id}`, patch)))
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      setSelectedIds(new Set())
    },
  })

  const setStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'demo' | 'inactive' }) => {
      const patch =
        status === 'active' ? { is_active: true, is_demo: false } :
        status === 'demo'   ? { is_active: true,  is_demo: true  } :
                              { is_active: false }
      return api.patch(`/admin/tenants/${id}`, patch).then((r: any) => r.data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectableVisible = visible.filter((t: any) => !isOwnTenant(t))

  function toggleAll() {
    if (selectedIds.size === selectableVisible.length && selectableVisible.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableVisible.map((t: any) => t.id)))
    }
  }

  const allSelected = selectableVisible.length > 0 && selectedIds.size === selectableVisible.length
  const someSelected = selectedIds.size > 0

  function copyInboundEmail(slug: string, email: string) {
    copyEmail(email)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: t('admin_filter_active') },
    { key: 'demo', label: t('admin_filter_demo') },
    { key: 'inactive', label: t('admin_filter_inactive') },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-xl text-slate-900">
            {pageTab === 'dashboard' ? t('admin_page_dashboard_title') : t('admin_page_clients_title')}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {pageTab === 'dashboard' ? t('admin_page_dashboard_desc') : t('admin_page_clients_desc')}
          </p>
        </div>
        {pageTab === 'clients' && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            <Plus size={15} strokeWidth={2.5} />
            {t('admin_new_client_btn')}
          </button>
        )}
      </div>

      {/* Top-level tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 -mt-4">
        {([
          { key: 'clients', label: t('admin_tab_clients'), icon: <Building2 size={14} /> },
          { key: 'dashboard', label: t('admin_tab_dashboard'), icon: <LayoutDashboard size={14} /> },
        ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setPageTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              pageTab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'dashboard' && <DashboardTab tenants={tenants} />}

      {pageTab === 'clients' && (<>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 -mt-4">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setSelectedIds(new Set()) }}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              filter === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
              filter === key ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-slate-400">{t('admin_loading')}</p>}

      {!isLoading && visible.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {filter === 'all' ? t('admin_no_clients') : t('admin_no_clients_filter').replace('{filter}', filter)}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Bulk action bar */}
          {someSelected && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-200">
              <span className="text-sm font-semibold text-blue-700">{t('admin_bulk_selected').replace('{n}', String(selectedIds.size))}</span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => bulkMutation.mutate({ is_active: true, is_demo: false })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  {t('admin_bulk_set_active')}
                </button>
                <button
                  onClick={() => bulkMutation.mutate({ is_demo: true, is_active: true })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  {t('admin_bulk_set_demo')}
                </button>
                <button
                  onClick={() => bulkMutation.mutate({ is_active: false })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {t('admin_bulk_set_inactive')}
                </button>
                {isRootOwner && (
                  <button
                    onClick={() => setBulkDeletingTenants(visible.filter((t: any) => selectedIds.has(t.id)))}
                    disabled={bulkMutation.isPending}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                )}
                <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-slate-600 ml-1">
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="pl-4 pr-2 py-3 w-8">
                  <button onClick={toggleAll} className="text-slate-400 hover:text-slate-600 transition-colors">
                    {allSelected ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_client')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_status')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_plan')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">{t('admin_col_ai')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_modules')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_users')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_created')}</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">{t('admin_col_sending_domain')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((tenant: any) => {
                const status = statusOf(tenant)
                const isSelected = selectedIds.has(tenant.id)
                const own = isOwnTenant(tenant)
                return (
                  <tr
                    key={tenant.id}
                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''} ${!tenant.is_active ? 'opacity-60' : ''}`}
                  >
                    <td className="pl-4 pr-2 py-3 w-8">
                      {own ? (
                        <Lock size={13} className="text-slate-300 mx-auto" />
                      ) : (
                        <button onClick={() => toggleRow(tenant.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isSelected ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tenant.primary_color }} />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{tenant.name}</div>
                          <div className="text-xs text-slate-400">{tenant.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {own ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[status]}`}>{status}</span>
                      ) : (
                        <select
                          value={status}
                          onChange={e => setStatusMutation.mutate({ id: tenant.id, status: e.target.value as 'active' | 'demo' | 'inactive' })}
                          disabled={setStatusMutation.isPending}
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-300 disabled:opacity-50 ${STATUS_PILL[status]}`}
                        >
                          <option value="active">active</option>
                          <option value="demo">demo</option>
                          <option value="inactive">inactive</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_BADGE[tenant.plan] ?? 'bg-slate-100 text-slate-600'}`}>{planLabel(tenant.plan)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DonutChart
                        used={aiUsageByTenant[tenant.id] ?? 0}
                        limit={PLAN_AI_LIMITS[tenant.plan] ?? null}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setEditingTenant(tenant); setEditingTab('modules') }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {t('admin_modules_count').replace('{n}', String(tenant.enabled_modules.length))}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setViewingUsersTenant(tenant)}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                        title="View users"
                      >
                        <Users size={13} />
                        {tenant.user_count}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(tenant.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      {!tenant.resend_domain_id ? (
                        <button
                          onClick={() => setProvisionModalTenant(tenant)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Globe size={12} />
                          {t('admin_set_up_domain')}
                        </button>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {tenant.resend_domain_status === 'verified' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                                <ShieldCheck size={10} /> {t('admin_verified_domain')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full">
                                {t('admin_pending_domain')}
                              </span>
                            )}
                            <span className="text-xs text-slate-400 font-mono truncate max-w-[120px]" title={tenant.resend_domain_name ?? ''}>
                              {tenant.resend_domain_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setDnsModalTenant(tenant)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                              title="View DNS records"
                            >
                              <Copy size={10} />
                              {t('admin_view_dns')}
                            </button>
                            {tenant.resend_domain_status !== 'verified' && (
                              <button
                                onClick={() => { setVerifyingId(tenant.id); verifyDomainMutation.mutate(tenant.id) }}
                                disabled={verifyingId === tenant.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                                title="Check DNS and verify"
                              >
                                <RefreshCw size={10} className={verifyingId === tenant.id ? 'animate-spin' : ''} />
                                {t('admin_verify_btn')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {tenant.is_active && !own && (
                          <button
                            onClick={() => impersonateMutation.mutate(tenant.id)}
                            disabled={impersonateMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                            title="Log in as this client's admin (read/write, be careful)"
                          >
                            <Eye size={11} />
                            {t('admin_view_as')}
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingTenant(tenant); setEditingTab(undefined) }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Pencil size={11} />
                          {t('admin_edit')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ResendDiagnosticPanel />
      <EvolutionDiagnosticPanel />
      </>)}

      {showCreate && <CreateClientModal onClose={() => setShowCreate(false)} />}
      {viewingUsersTenant && (
        <TenantUsersModal tenant={viewingUsersTenant} onClose={() => setViewingUsersTenant(null)} />
      )}
      {editingTenant && (
        <EditClientModal
          tenant={editingTenant}
          onClose={() => { setEditingTenant(null); setEditingTab(undefined) }}
          togglingActive={toggleActiveMutation.isPending}
          onToggleActive={() => toggleActiveMutation.mutate({ id: editingTenant.id, is_active: !editingTenant.is_active })}
          onCopyEmail={() => editingTenant.inbound_email && copyInboundEmail(editingTenant.slug, editingTenant.inbound_email)}
          copied={copiedSlug === editingTenant.slug}
          onRequestDelete={() => { setEditingTenant(null); setEditingTab(undefined); setDeletingTenant(editingTenant) }}
          onGoLive={() => goLiveMutation.mutate(editingTenant.id)}
          goingLive={goLiveMutation.isPending}
          isOwnTenant={isOwnTenant(editingTenant)}
          defaultTab={editingTab}
        />
      )}
      {deletingTenant && <DeleteClientModal tenant={deletingTenant} onClose={() => setDeletingTenant(null)} />}
{bulkDeletingTenants && (
        <BulkDeleteClientsModal
          tenants={bulkDeletingTenants}
          onClose={() => { setBulkDeletingTenants(null); setSelectedIds(new Set()) }}
        />
      )}
      {dnsModalTenant && (
        <DnsRecordsModal tenant={dnsModalTenant} onClose={() => setDnsModalTenant(null)} />
      )}
      {provisionModalTenant && (
        <ProvisionDomainModal
          tenant={provisionModalTenant}
          onClose={() => setProvisionModalTenant(null)}
          onSuccess={(updated) => {
            qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
            setProvisionModalTenant(null)
            setDnsModalTenant(updated)
          }}
        />
      )}
    </div>
  )
}
