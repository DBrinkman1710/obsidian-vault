import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useTenantConfig } from '../App'
import YipTrainModal from './YipTrainModal'
import MakeItYoursModal from './MakeItYoursModal'
import { useT } from '../hooks/useT'

const DEFAULT_BRAND_COLOR = '#5BA4F5'

// Every tenant is seeded with the Agent + Viewer roles (see
// provision_default_rbac_roles), so the Roles gate only counts as done once the
// admin has added a role of their own beyond those two.
const DEFAULT_RBAC_ROLE_COUNT = 2

interface Gate {
  id: string
  label: string
  detail: string
  route?: string
  action?: () => void
  done: boolean
  optional?: boolean
}

export default function SetupChecklist() {
  const { user, refreshUser } = useAuth()
  const t = useT()
  const navigate = useNavigate()
  const config = useTenantConfig()
  const tourActive = !user?.tour_completed
  const [collapsed, setCollapsed] = useState(true)
  const prevTourActive = useRef(tourActive)
  const [showYipTrain, setShowYipTrain] = useState(false)
  const [yipTrainDone, setYipTrainDone] = useState(false)
  const [showMakeItYours, setShowMakeItYours] = useState(false)

  // The Departments + Roles gates stay hidden until the admin opens their
  // profile for the first time; the click flips this flag (persisted per user).
  const profileOpenedKey = user ? `profile_opened_${user.id}` : null
  const [profileOpened, setProfileOpened] = useState(
    () => !!profileOpenedKey && localStorage.getItem(profileOpenedKey) === '1',
  )

  const isAdmin = user?.role === 'admin'
  // The jarvis train endpoint is mounted behind require_module("ai") +
  // require_feature("ai") on the backend, so tenants without the ai module
  // (or a plan that allows it) would 403/402 and could never complete a
  // "Train Yip" gate — only show it when the tenant can actually call it.
  const aiEnabled = (config?.enabled_modules ?? []).includes('ai')
    && (config?.allowed_features ?? []).includes('ai')

  const departmentsEnabled = (config?.enabled_modules ?? []).includes('departments')
  // A returning admin who already set a reply-from address has clearly been to
  // their profile before, so treat that as "opened" too.
  const profileReached = profileOpened || !!user?.reply_from_email

  // Branding is "made yours" once the colour differs from the platform default,
  // a logo has been set, or the user explicitly saved their branding at least
  // once (marked in localStorage on save so a tenant who deliberately keeps the
  // default blue with no logo can still complete the gate).
  const brandingCustomised =
    (!!config?.branding?.primary_color && config.branding.primary_color.toLowerCase() !== DEFAULT_BRAND_COLOR.toLowerCase())
    || !!config?.branding?.logo_url
    || (!!config?.tenant_id && localStorage.getItem(`made_it_yours_${config.tenant_id}`) === '1')

  // Share the source pages' query keys (['team-users'] in TeamSettingsPage,
  // ['signatures'] in useSignatures/ProfileSettingsPage) so their mutation
  // invalidations flip these gates immediately.
  const teamQuery = useQuery({
    queryKey: ['team-users'],
    queryFn: () => api.get('/team/users').then((r: any) => r.data as { id: string }[]),
    enabled: isAdmin && !!user && !user.setup_checklist_dismissed,
    staleTime: 5 * 60 * 1000,
  })

  const signatureQuery = useQuery({
    queryKey: ['signatures'],
    queryFn: () => api.get('/auth/me/signatures').then((r: any) => r.data as { id: string }[]),
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !user.setup_checklist_dismissed,
  })

  // Same query keys as TeamSettingsPage (['departments'], ['rbac-roles']) so
  // creating a department or role there flips these gates immediately. Only
  // fetched once the gates can appear (admin, module on, profile opened).
  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r: any) => r.data as { id: string }[]),
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin && departmentsEnabled && profileReached && !!user && !user.setup_checklist_dismissed,
  })

  const rolesQuery = useQuery({
    queryKey: ['rbac-roles'],
    queryFn: () => api.get('/rbac/roles').then((r: any) => r.data as { id: string }[]),
    staleTime: 5 * 60 * 1000,
    enabled: isAdmin && profileReached && !!user && !user.setup_checklist_dismissed,
  })

  const gates: Gate[] = [
    {
      // Always done gate: keeps the "X of Y complete" header count above zero
      // so the checklist never opens with no visible momentum.
      id: 'account',
      label: t('shared_gate_account'),
      detail: '',
      done: true,
    },
    {
      id: 'profile',
      label: t('shared_gate_profile'),
      detail: t('shared_gate_profile_detail'),
      route: '/settings/profile',
      done: !!user?.reply_from_email,
    },
    ...(isAdmin && departmentsEnabled && profileReached ? [{
      id: 'departments',
      label: t('shared_gate_departments'),
      detail: t('shared_gate_departments_detail'),
      route: '/settings/team',
      done: (departmentsQuery.data?.length ?? 0) > 0,
      optional: true,
    }] : []),
    ...(isAdmin && profileReached ? [{
      id: 'roles',
      label: t('shared_gate_roles'),
      detail: t('shared_gate_roles_detail'),
      route: '/settings/team',
      done: (rolesQuery.data?.length ?? 0) > DEFAULT_RBAC_ROLE_COUNT,
      optional: true,
    }] : []),
    {
      id: 'signature',
      label: t('shared_gate_signature'),
      detail: t('shared_gate_signature_detail'),
      route: '/settings/profile',
      done: (signatureQuery.data?.length ?? 0) > 0,
      optional: true,
    },
    ...(isAdmin && aiEnabled ? [{
      id: 'yip-train',
      label: t('shared_gate_yip_train'),
      detail: t('shared_gate_yip_train_detail'),
      action: () => setShowYipTrain(true),
      done: yipTrainDone || !!(config?.ai_profile),
    }] : []),
    ...(isAdmin ? [{
      id: 'make-it-yours',
      label: t('shared_gate_make_it_yours'),
      detail: t('shared_gate_make_it_yours_detail'),
      action: () => setShowMakeItYours(true),
      done: brandingCustomised,
    }] : []),
    ...(isAdmin ? [{
      id: 'team',
      label: t('shared_gate_team'),
      detail: t('shared_gate_team_detail'),
      route: '/settings/team',
      done: (teamQuery.data?.length ?? 0) > 1,
      optional: true,
    }] : []),
  ]

  const requiredGates = gates.filter(g => !g.optional)
  const completedCount = requiredGates.filter(g => g.done).length
  const allDone = requiredGates.every(g => g.done)

  const dismissMutation = useMutation({
    mutationFn: () => api.patch('/auth/me', { setup_checklist_dismissed: true }).then((r: any) => r.data),
    onSuccess: () => refreshUser(),
  })

  useEffect(() => {
    if (allDone && !dismissMutation.isPending && !dismissMutation.isSuccess) {
      const t = setTimeout(() => dismissMutation.mutate(), 3000)
      return () => clearTimeout(t)
    }
  }, [allDone, dismissMutation.isPending, dismissMutation.isSuccess])

  // Auto-expand when tour is dismissed/completed
  useEffect(() => {
    if (prevTourActive.current && !tourActive) {
      setCollapsed(false)
    }
    prevTourActive.current = tourActive
  }, [tourActive])

  if (user?.setup_checklist_dismissed) return null
  if (signatureQuery.isLoading || (isAdmin && teamQuery.isLoading)) return null

  return (
    <>
    {/* Positioned by App's bottom-right column: sits below the tour while it
        runs (collapsed by default), then auto-expands and takes the tour's
        place when it finishes (effect above). */}
    <div className="w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {allDone ? t('shared_all_done') : t('shared_get_started')}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {allDone ? t('shared_workspace_ready') : `${completedCount} ${t('shared_of_complete')} ${requiredGates.length} ${t('shared_complete')}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={collapsed ? t('shared_expand') : t('shared_collapse')}
          >
            {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={() => dismissMutation.mutate()}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={t('shared_dismiss')}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* No progress bar here on purpose: endowed progress is a conversion
          device for the commercial onboarding — inside the workspace the
          customer is already committed, so the bar is just noise. */}

      {/* Gate list */}
      {!collapsed && (
        <ul className="divide-y divide-slate-50">
          {gates.map(gate => (
            <li key={gate.id}>
              <button
                disabled={gate.done}
                onClick={() => {
                  if (gate.id === 'profile' && profileOpenedKey && !profileOpened) {
                    localStorage.setItem(profileOpenedKey, '1')
                    setProfileOpened(true)
                  }
                  if (gate.action) gate.action()
                  else if (gate.route) navigate(gate.route)
                }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 disabled:cursor-default transition-colors"
              >
                {gate.done
                  ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  : <Circle size={18} className="text-slate-300 shrink-0 mt-0.5" />
                }
                <div>
                  <p className={`text-xs font-semibold ${gate.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {gate.label}
                    {gate.optional && !gate.done && (
                      <span className="text-[10px] text-slate-400 font-normal ml-1">{t('shared_optional')}</span>
                    )}
                  </p>
                  {!gate.done && (
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{gate.detail}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>

    {showYipTrain && (
      <YipTrainModal
        tenantName={config?.tenant_name ?? ''}
        onComplete={() => {
          setShowYipTrain(false)
          setYipTrainDone(true)
        }}
        onDismiss={() => setShowYipTrain(false)}
      />
    )}

    {showMakeItYours && (
      <MakeItYoursModal
        tenantId={config?.tenant_id ?? null}
        initialColor={config?.branding?.primary_color}
        initialLogoUrl={config?.branding?.logo_url}
        onDismiss={() => setShowMakeItYours(false)}
      />
    )}
    </>
  )
}
