import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Users, X, Building2, UserPlus,
  ToggleLeft, ToggleRight, Rocket, FlaskConical, CheckSquare, Square,
  Clipboard, Check, Eye, Trash2, Pencil, Lock,
  LayoutDashboard, AlertTriangle, Inbox, Sparkles, Ticket as TicketIcon,
} from 'lucide-react'
import { api } from '../../../api/client'
import { ROOT_OWNER_EMAIL, useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'

const ALL_MODULES = ['inbox', 'contacts', 'tickets', 'calendar', 'pipeline', 'booking', 'activity', 'billing', 'chat', 'ai', 'departments', 'marketing']

const MODULE_LABELS: Record<string, string> = { ai: 'AI', booking: 'Booking', departments: 'Departments', marketing: 'Marketing' }
const moduleLabel = (mod: string) => MODULE_LABELS[mod] ?? mod

// SaaS plan tiers — mirrors PlanTier on the backend (app/core/plans.py).
const PLAN_TIERS = ['founder', 'starter', 'growth', 'pro'] as const
const planLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1)

// AI scan limits per plan — mirrors PLAN_LIMITS in app/core/plans.py.
const PLAN_AI_LIMITS: Record<string, number | null> = {
  founder: 500, starter: 2_000, growth: 10_000, pro: null, enterprise: null,
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
  whatsapp_phone_number_id: string | null
  whatsapp_access_token: string | null
  whatsapp_verify_token: string | null
  ai_auto_scan: boolean
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
function useEmailCheckError(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(trimmed), 500)
    return () => clearTimeout(t)
  }, [trimmed])

  const settled = debounced === trimmed && trimmed.length > 0
  const validFormat = EMAIL_RE.test(trimmed)

  const { data } = useQuery<{ available: boolean; reason: string | null }>({
    queryKey: ['check-email', debounced],
    queryFn: () => api.get('/admin/check-email', { params: { email: debounced } }).then(r => r.data),
    enabled: settled && validFormat,
    staleTime: 30_000,
  })

  if (!settled) return null
  if (!validFormat) return 'Not a valid email address'
  if (data && !data.available) return data.reason ?? 'This email is not available'
  return null
}

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
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
  const qc = useQueryClient()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [extraEmail, setExtraEmail] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ invites: string[] } | null>(null)
  const adminEmailError = useEmailCheckError(form.admin_email)
  const extraEmailError = useEmailCheckError(extraEmail)

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
          const autoEmail = prev.slug ? `${prev.slug}-support@getyippie.com` : ''
          if (!prev.inbound_email || prev.inbound_email === autoEmail)
            next.inbound_email = val ? `${val}-support@getyippie.com` : ''
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
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      const invites = form.admin_password.trim() ? [] : [form.admin_email.trim()]
      setCreated({ invites: [...invites, ...form.extra_admin_emails] })
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to create client')
    },
  })

  function stepError(): string {
    if (step === 0) {
      if (!form.name.trim() || !form.slug.trim()) return 'Company name and slug are required'
      if (!EMAIL_RE.test(form.admin_email.trim())) return 'A valid admin email is required'
      if (adminEmailError) return adminEmailError
    }
    if (step === 1 && form.enabled_modules.length === 0) return 'Enable at least one module'
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
    if (!EMAIL_RE.test(email)) { setError('Enter a valid email address'); return }
    if (extraEmailError) { setError(extraEmailError); return }
    if (email === form.admin_email.trim().toLowerCase() || form.extra_admin_emails.includes(email)) {
      setError('That email is already on the list'); return
    }
    setError('')
    setForm(p => ({ ...p, extra_admin_emails: [...p.extra_admin_emails, email] }))
    setExtraEmail('')
  }

  if (created) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Check size={16} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{form.name} created</h2>
          </div>
          {created.invites.length > 0 ? (
            <p className="text-sm text-slate-600">
              Invite emails sent to <strong>{created.invites.join(', ')}</strong> — each admin sets their own password via the link.
            </p>
          ) : (
            <p className="text-sm text-slate-600">The admin account is ready to log in.</p>
          )}
          <div className="flex justify-end">
            <button onClick={onClose} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">New client</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
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
                <div><label className={labelCls}>Company name *</label>
                  <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Acme BV" autoFocus /></div>
                <div><label className={labelCls}>Slug *</label>
                  <input className={inputCls} value={form.slug} onChange={set('slug')} placeholder="acme-bv" /></div>
              </div>
              <div>
                <label className={labelCls}>Inbound email</label>
                <input className={inputCls} type="email" value={form.inbound_email} onChange={set('inbound_email')} placeholder="acme-bv-support@getyippie.com" />
                <p className="mt-1 text-xs text-slate-400">Address to configure in Resend. Auto-suggested from slug.</p>
              </div>
              <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Admin name</label>
                  <input className={inputCls} value={form.admin_full_name} onChange={set('admin_full_name')} placeholder="Jan de Vries" /></div>
                <div><label className={labelCls}>Admin email *</label>
                  <input className={inputCls} type="email" value={form.admin_email} onChange={set('admin_email')} placeholder="admin@acme.nl" />
                  {adminEmailError && <p className="mt-1 text-xs text-red-500">{adminEmailError}</p>}</div>
              </div>
              <div>
                <label className={labelCls}>Admin password</label>
                <input className={inputCls} type="password" value={form.admin_password} onChange={set('admin_password')} placeholder="••••••••" />
                <p className="mt-1 text-xs text-slate-400">Leave empty to email an invite link — the admin sets their own password.</p>
              </div>
            </>
          )}

          {step === 1 && (
            <div>
              <label className={labelCls}>Enabled modules</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALL_MODULES.map(mod => (
                  <ModuleToggle key={mod} mod={mod} active={form.enabled_modules.includes(mod)} onClick={() => toggleModule(mod)} />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <div>
                <label className={labelCls}>Brand color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primary_color}
                    onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                  />
                  <span className="text-sm text-slate-500 font-mono">{form.primary_color}</span>
                </div>
              </div>
              <div>
                <label className={labelCls}>Logo URL</label>
                <input className={inputCls} value={form.logo_url} onChange={set('logo_url')} placeholder="https://acme.nl/logo.png" />
                <p className="mt-1 text-xs text-slate-400">Optional — shown in the client's sidebar.</p>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className={labelCls}>Extra admin users</label>
                <div className="flex gap-2">
                  <input className={inputCls} type="email" value={extraEmail}
                    onChange={e => setExtraEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExtraEmail() } }}
                    placeholder="collega@acme.nl" />
                  <button type="button" onClick={addExtraEmail} className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">Add</button>
                </div>
                {extraEmailError && <p className="mt-1 text-xs text-red-500">{extraEmailError}</p>}
                <p className="mt-1 text-xs text-slate-400">Optional — each gets an invite email to set their own password.</p>
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
              <div className="flex flex-col gap-2">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.is_demo ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={form.is_demo} onChange={() => setForm(p => ({ ...p, is_demo: true }))} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Start as demo</span>
                    <span className="block text-xs text-slate-500">Outbound email is suppressed; the client sees an amber demo banner.</span>
                  </span>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${!form.is_demo ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" checked={!form.is_demo} onChange={() => setForm(p => ({ ...p, is_demo: false }))} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Go live immediately</span>
                    <span className="block text-xs text-slate-500">Fully active from the start — emails are sent for real.</span>
                  </span>
                </label>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 flex flex-col gap-1">
                <span><strong className="text-slate-900">{form.name}</strong> ({form.slug})</span>
                <span>Modules: {form.enabled_modules.map(moduleLabel).join(', ')}</span>
                <span>
                  Admin: {form.admin_email}{form.admin_password.trim() ? '' : ' (invite email)'}
                  {form.extra_admin_emails.length > 0 && ` + ${form.extra_admin_emails.length} invited`}
                </span>
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            {step > 0 && (
              <button type="button" onClick={() => { setError(''); setStep(step - 1) }} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors mr-auto">Back</button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {step < WIZARD_STEPS.length - 1 ? 'Next' : mutation.isPending ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type EditTab = 'info' | 'modules' | 'branding' | 'whatsapp' | 'users' | 'actions'

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
  const qc = useQueryClient()
  const { user } = useAuth()
  const isRootOwner = user?.email?.toLowerCase() === ROOT_OWNER_EMAIL
  const [tab, setTab] = useState<EditTab>(defaultTab ?? 'info')
  const [form, setForm] = useState({
    name: tenant.name,
    inbound_email: tenant.inbound_email ?? '',
    kvk_nummer: tenant.kvk_nummer ?? '',
    btw_nummer: tenant.btw_nummer ?? '',
    enabled_modules: ALL_MODULES.filter(m => tenant.enabled_modules.includes(m)),
    plan: tenant.plan,
    primary_color: tenant.primary_color,
    logo_url: tenant.logo_url ?? '',
    whatsapp_phone_number_id: tenant.whatsapp_phone_number_id ?? '',
    whatsapp_access_token: tenant.whatsapp_access_token ?? '',
    whatsapp_verify_token: tenant.whatsapp_verify_token ?? '',
    ai_auto_scan: tenant.ai_auto_scan ?? false,
    demo_days_remaining: demoDaysRemaining(tenant.demo_expires_at),
  })
  const [error, setError] = useState('')
  const [showAddAdmin, setShowAddAdmin] = useState(false)

  const mutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch(`/admin/tenants/${tenant.id}`, patch).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: () => setError('Failed to save changes'),
  })

  const { data: usersData, isLoading: usersLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users', tenant.id],
    queryFn: () => api.get(`/admin/tenants/${tenant.id}/users`).then(r => r.data),
    enabled: tab === 'users',
  })

  const toggleUserMutation = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      api.patch(`/admin/tenants/${tenant.id}/users/${userId}`, { is_active }).then(r => r.data),
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
    { key: 'info', label: 'Info' },
    { key: 'modules', label: 'Modules' },
    { key: 'branding', label: 'Branding' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'users', label: 'Users' },
    { key: 'actions', label: 'Actions' },
  ]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit client</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex border-b border-slate-100 px-6">
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

        <div className="p-6 flex flex-col gap-4">
          {tab === 'info' && (
            <>
              <div>
                <label className={labelCls}>Company name</label>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={tenant.name}
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>Inbound email</label>
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
                      title="Copy inbound email"
                    >
                      {copied ? <Check size={13} className="text-emerald-500" /> : <Clipboard size={13} />}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">Address Resend routes to this client. Leave empty to disable inbound routing.</p>
              </div>
              <div>
                <label className={labelCls}>Slug</label>
                <input className={`${inputCls} opacity-50 cursor-not-allowed`} value={tenant.slug} disabled />
                <p className="mt-1 text-xs text-slate-400">Slug cannot be changed after creation.</p>
              </div>
              <div>
                <label className={labelCls}>Plan</label>
                <select
                  className={inputCls}
                  value={form.plan}
                  onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                >
                  {PLAN_TIERS.map(p => (
                    <option key={p} value={p}>{planLabel(p)}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">Higher tiers unlock advanced features (chat, calendar, pipeline, email tracking, AI).</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>KvK-nummer</label>
                  <input
                    className={inputCls}
                    value={form.kvk_nummer}
                    onChange={e => setForm(p => ({ ...p, kvk_nummer: e.target.value }))}
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className={labelCls}>Btw-nummer</label>
                  <input
                    className={inputCls}
                    value={form.btw_nummer}
                    onChange={e => setForm(p => ({ ...p, btw_nummer: e.target.value }))}
                    placeholder="NL123456789B01"
                  />
                </div>
              </div>
              {tenant.is_demo && (
                <div>
                  <label className={labelCls}>Demo days remaining</label>
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
                    Extends or shortens this demo from today.
                    {tenant.demo_expires_at && (
                      <> Current expiry: {new Date(tenant.demo_expires_at).toLocaleDateString()}.</>
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
                  <span className="block text-sm font-semibold text-slate-800">Auto-run inbox AI</span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    When on, AI scans &amp; briefs every incoming thread automatically. When off (default),
                    agents click Generate per draft. Requires the AI module.
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
                <label className={labelCls}>Brand color</label>
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
                    Reset to default
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Logo URL</label>
                <input
                  className={inputCls}
                  value={form.logo_url}
                  onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
                  placeholder="https://company.nl/logo.png"
                />
                <p className="mt-1 text-xs text-slate-400">Shown in the client's sidebar. Leave empty for the default Yippie logo.</p>
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
                Meta Cloud API credentials for this client's WhatsApp Business account.
                Webhook URL to register in Meta: <span className="font-mono">https://app.getyippie.com/api/v1/chat/webhooks/{tenant.slug}/whatsapp</span>
              </p>
              <div>
                <label className={labelCls}>Phone Number ID</label>
                <input
                  className={inputCls}
                  value={form.whatsapp_phone_number_id}
                  onChange={e => setForm(p => ({ ...p, whatsapp_phone_number_id: e.target.value }))}
                  placeholder="123456789012345"
                />
                <p className="mt-1 text-xs text-slate-400">From Meta Developer Console → WhatsApp → API Setup.</p>
              </div>
              <div>
                <label className={labelCls}>Access Token</label>
                <input
                  className={inputCls}
                  type="password"
                  value={form.whatsapp_access_token}
                  onChange={e => setForm(p => ({ ...p, whatsapp_access_token: e.target.value }))}
                  placeholder="EAAxxxxx…"
                />
                <p className="mt-1 text-xs text-slate-400">Permanent system user token from Meta Business Manager.</p>
              </div>
              <div>
                <label className={labelCls}>Verify Token</label>
                <input
                  className={inputCls}
                  value={form.whatsapp_verify_token}
                  onChange={e => setForm(p => ({ ...p, whatsapp_verify_token: e.target.value }))}
                  placeholder="any-secret-string-you-choose"
                />
                <p className="mt-1 text-xs text-slate-400">Any string you set when configuring the webhook in Meta.</p>
              </div>
            </>
          )}

          {tab === 'users' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Team members</span>
                <button
                  type="button"
                  onClick={() => setShowAddAdmin(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <UserPlus size={12} />
                  Add admin
                </button>
              </div>
              {usersLoading && <p className="text-sm text-slate-400">Loading…</p>}
              {usersData && usersData.length === 0 && <p className="text-sm text-slate-400">No users yet.</p>}
              {usersData && usersData.length > 0 && (
                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {usersData.map(u => (
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
                        title={u.role === 'superadmin' ? 'Superadmins cannot be deactivated' : u.is_active ? 'Deactivate' : 'Activate'}
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
                  <p className="text-sm text-slate-500">This is your own environment — it cannot be deactivated, set to demo, or deleted.</p>
                </div>
              ) : (
                <>
                  {tenant.is_demo && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700">Go live</p>
                        <p className="text-xs text-slate-400">Ends demo mode and enables real email sending.</p>
                      </div>
                      <button
                        onClick={() => { onGoLive?.(); onClose() }}
                        disabled={goingLive}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                      >
                        <Rocket size={13} />
                        Go live
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{tenant.is_active ? 'Active' : 'Inactive'}</p>
                      <p className="text-xs text-slate-400">{tenant.is_active ? 'Users can log in and send mail.' : 'Login is blocked for this client.'}</p>
                    </div>
                    <button
                      onClick={() => { onToggleActive(); onClose() }}
                      disabled={togglingActive}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      {tenant.is_active
                        ? <><ToggleRight size={14} className="text-emerald-500" /> Deactivate</>
                        : <><ToggleLeft size={14} className="text-slate-400" /> Activate</>}
                    </button>
                  </div>

                  {isRootOwner && (
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                      <div>
                        <p className="text-sm font-semibold text-red-600">Delete client</p>
                        <p className="text-xs text-slate-400">Removes this client and all its data — irreversible.</p>
                      </div>
                      <button
                        onClick={onRequestDelete}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {tab === 'actions' || tab === 'users' ? 'Close' : 'Cancel'}
            </button>
            {tab !== 'actions' && tab !== 'users' && (
              <button
                onClick={handleSave}
                disabled={mutation.isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {mutation.isPending ? 'Saving…' : 'Save changes'}
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
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post(`/admin/tenants/${tenant.id}/delete`, { current_password: password }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to delete client')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) { setError('Password required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-red-600">Delete client</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm text-red-700">
              This permanently wipes <strong>{tenant.name}</strong> — all users, contacts, tickets, messages and invoices. <strong>This cannot be undone.</strong>
            </p>
          </div>
          <div>
            <label className={labelCls}>Your password</label>
            <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirm with your password" autoFocus />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddAdminModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ email: '', password: '', full_name: 'Admin' })
  const [error, setError] = useState('')
  const [invited, setInvited] = useState<string | null>(null)
  const emailError = useEmailCheckError(form.email)

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/admin/tenants/${tenant.id}/users`, {
        ...form,
        email: form.email.trim(),
        password: form.password.trim() || null,
      }).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['superadmin-tenants'] })
      qc.invalidateQueries({ queryKey: ['tenant-users', tenant.id] })
      if (data?.invited) setInvited(data.email)
      else onClose()
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to add admin')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(form.email.trim())) { setError('A valid email is required'); return }
    if (emailError) { setError(emailError); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add admin</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        {invited ? (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-emerald-600 font-medium">
              ✓ Invite sent to <strong>{invited}</strong> — they appear in the list once they set their password.
            </p>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors">Done</button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className={labelCls}>Full name</label>
            <input className={inputCls} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Admin" />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="admin@company.nl" autoFocus />
            {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
          </div>
          <div>
            <label className={labelCls}>Password</label>
            <input className={inputCls} type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
            <p className="mt-1 text-xs text-slate-400">Leave empty to email an invite link — the admin sets their own password.</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? 'Adding…' : form.password.trim() ? 'Add admin' : 'Send invite'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}

function BulkDeleteClientsModal({ tenants, onClose }: { tenants: Tenant[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      Promise.all(tenants.map(t => api.post(`/admin/tenants/${t.id}/delete`, { current_password: password }))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }); onClose() },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to delete — check your password')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) { setError('Password required'); return }
    setError('')
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-red-600">Delete {tenants.length} client{tenants.length !== 1 ? 's' : ''}</h2>
            <p className="text-sm text-slate-400 mt-0.5">This cannot be undone</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-32 overflow-y-auto">
            {tenants.map(t => (
              <p key={t.id} className="text-sm text-red-700"><strong>{t.name}</strong> — all users, contacts and data wiped.</p>
            ))}
          </div>
          <div>
            <label className={labelCls}>Your password</label>
            <input className={inputCls} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Confirm with your password" autoFocus />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed">
              {mutation.isPending ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function TenantUsersModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const { data, isLoading } = useQuery<TenantUser[]>({
    queryKey: ['tenant-users', tenant.id],
    queryFn: () => api.get(`/admin/tenants/${tenant.id}/users`).then(r => r.data),
  })

  function fmtLastActive(val: string | null): string {
    if (!val) return '—'
    const d = new Date(val)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 2) return 'Just now'
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
            <h2 className="text-lg font-bold text-slate-900">Users</h2>
            <p className="text-sm text-slate-400 mt-0.5">{tenant.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">
          {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
          {!isLoading && (!data || data.length === 0) && (
            <p className="text-sm text-slate-400">No users yet.</p>
          )}
          {data && data.length > 0 && (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span>Name / Email</span>
                <span>Role</span>
                <span>Last active</span>
                <span>Status</span>
              </div>
              {data.map(u => (
                <div key={u.id} className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 ${!u.is_active ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{u.full_name}</div>
                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${ROLE_STYLES[u.role] ?? ROLE_STYLES.viewer}`}>{u.role}</span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">{fmtLastActive(u.last_login_at)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResendDiagnosticPanel() {
  const [result, setResult] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.get('/admin/resend-check').then(r => r.data),
    onSuccess: (data) => setResult(data),
  })

  function copyAll() {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <FlaskConical size={14} className="text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 flex-1">API diagnostics</span>
        {result && (
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Clipboard size={12} />}
            {copied ? 'Copied' : 'Copy all'}
          </button>
        )}
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {mutation.isPending ? 'Checking…' : 'Run check'}
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

const RANGE_TABS: { key: DateRange; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
]

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
  const [range, setRange] = useState<DateRange>('7d')
  const [tenantFilter, setTenantFilter] = useState<string>('')

  const params: Record<string, string> = {}
  const start = rangeStart(range)
  if (start) params.start = start
  if (tenantFilter) params.tenant_id = tenantFilter

  const { data, isLoading } = useQuery<SuperAdminStats>({
    queryKey: ['superadmin-stats', range, tenantFilter],
    queryFn: () => api.get('/admin/stats', { params }).then(r => r.data),
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
          <option value="">All tenants</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {tenantFilter && (
          <button onClick={() => setTenantFilter('')} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
            Clear filter
          </button>
        )}
        <span className="text-xs text-slate-300 ml-auto">Auto-refreshes every 60s</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<Building2 size={16} />} label="Total tenants" value={summary?.total_tenants ?? 0} />
        <StatCard icon={<Check size={16} />} label="Active tenants" value={summary?.active_tenants ?? 0} />
        <StatCard icon={<TicketIcon size={16} />} label="Open tickets" value={summary?.total_tickets_open ?? 0} />
        <StatCard icon={<AlertTriangle size={16} />} label="Overdue tickets" value={summary?.total_tickets_overdue ?? 0} tone={summary && summary.total_tickets_overdue > 0 ? 'red' : 'default'} />
        <StatCard icon={<Inbox size={16} />} label="Inbox pending" value={summary?.total_inbox_pending ?? 0} />
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <LayoutDashboard size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-medium">No tenant activity to show.</p>
        </div>
      )}

      {/* Per-tenant table */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Tenant</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Open</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Overdue</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Pending inbox</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">AI uses today</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Contacts ({range === 'all' ? 'all' : range === '7d' ? '7d' : '30d'})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => {
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
  const qc = useQueryClient()
  const config = useTenantConfig()
  const navigate = useNavigate()
  const { user, startImpersonation } = useAuth()
  const isRootOwner = user?.email?.toLowerCase() === ROOT_OWNER_EMAIL
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

  const { data: allTenants, isLoading } = useQuery<Tenant[]>({
    queryKey: ['superadmin-tenants'],
    queryFn: () => api.get('/admin/tenants').then(r => r.data),
  })

  const monthStart = useMemo(() => {
    const d = new Date()
    d.setDate(1); d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  const { data: monthlyStats } = useQuery<SuperAdminStats>({
    queryKey: ['superadmin-stats-month', monthStart],
    queryFn: () => api.get('/admin/stats', { params: { start: monthStart } }).then(r => r.data),
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
    active: tenants.filter(t => statusOf(t) === 'active').length,
    demo: tenants.filter(t => statusOf(t) === 'demo').length,
    inactive: tenants.filter(t => statusOf(t) === 'inactive').length,
  }

  const visible = filter === 'all' ? tenants : tenants.filter(t => statusOf(t) === filter)

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/admin/tenants/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  const goLiveMutation = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/admin/tenants/${id}`, { is_demo: false, go_live_at: new Date().toISOString() }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['superadmin-tenants'] }),
  })

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/tenants/${id}/impersonate`).then(r => r.data),
    onSuccess: async (data) => {
      await startImpersonation(data.access_token, data.impersonated_tenant_name, data.impersonated_user_email)
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
      return api.patch(`/admin/tenants/${id}`, patch).then(r => r.data)
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

  const selectableVisible = visible.filter(t => !isOwnTenant(t))

  function toggleAll() {
    if (selectedIds.size === selectableVisible.length && selectableVisible.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableVisible.map(t => t.id)))
    }
  }

  const allSelected = selectableVisible.length > 0 && selectedIds.size === selectableVisible.length
  const someSelected = selectedIds.size > 0

  function copyInboundEmail(slug: string, email: string) {
    navigator.clipboard.writeText(email)
    setCopiedSlug(slug)
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const FILTER_TABS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'demo', label: 'Demo' },
    { key: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {pageTab === 'dashboard' ? 'Activity dashboard' : 'Client environments'}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {pageTab === 'dashboard' ? 'Live activity across all tenants' : 'Manage all tenant environments'}
          </p>
        </div>
        {pageTab === 'clients' && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} />
            New client
          </button>
        )}
      </div>

      {/* Top-level tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 -mt-4">
        {([
          { key: 'clients', label: 'Clients', icon: <Building2 size={14} /> },
          { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={14} /> },
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

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      {!isLoading && visible.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-slate-200">
          <Building2 size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {filter === 'all' ? 'No clients yet. Create the first one.' : `No ${filter} clients.`}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Bulk action bar */}
          {someSelected && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border-b border-blue-200">
              <span className="text-sm font-semibold text-blue-700">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => bulkMutation.mutate({ is_active: true, is_demo: false })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                >
                  Set Active
                </button>
                <button
                  onClick={() => bulkMutation.mutate({ is_demo: true, is_active: true })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  Set Demo
                </button>
                <button
                  onClick={() => bulkMutation.mutate({ is_active: false })}
                  disabled={bulkMutation.isPending}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Set Inactive
                </button>
                {isRootOwner && (
                  <button
                    onClick={() => setBulkDeletingTenants(visible.filter(t => selectedIds.has(t.id)))}
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
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Client</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Plan</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">AI</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Modules</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Users</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(t => {
                const status = statusOf(t)
                const isSelected = selectedIds.has(t.id)
                const own = isOwnTenant(t)
                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''} ${!t.is_active ? 'opacity-60' : ''}`}
                  >
                    <td className="pl-4 pr-2 py-3 w-8">
                      {own ? (
                        <Lock size={13} className="text-slate-300 mx-auto" />
                      ) : (
                        <button onClick={() => toggleRow(t.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          {isSelected ? <CheckSquare size={15} className="text-blue-600" /> : <Square size={15} />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.primary_color }} />
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{t.name}</div>
                          <div className="text-xs text-slate-400">{t.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {own ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[status]}`}>{status}</span>
                      ) : (
                        <select
                          value={status}
                          onChange={e => setStatusMutation.mutate({ id: t.id, status: e.target.value as 'active' | 'demo' | 'inactive' })}
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
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_BADGE[t.plan] ?? 'bg-slate-100 text-slate-600'}`}>{planLabel(t.plan)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DonutChart
                        used={aiUsageByTenant[t.id] ?? 0}
                        limit={PLAN_AI_LIMITS[t.plan] ?? null}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setEditingTenant(t); setEditingTab('modules') }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                      >
                        {t.enabled_modules.length} modules
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setViewingUsersTenant(t)}
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
                        title="View users"
                      >
                        <Users size={13} />
                        {t.user_count}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(t.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {t.is_active && !own && (
                          <button
                            onClick={() => impersonateMutation.mutate(t.id)}
                            disabled={impersonateMutation.isPending}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                            title="Log in as this client's admin (read/write — be careful)"
                          >
                            <Eye size={11} />
                            View as
                          </button>
                        )}
                        <button
                          onClick={() => { setEditingTenant(t); setEditingTab(undefined) }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <Pencil size={11} />
                          Edit
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
    </div>
  )
}
