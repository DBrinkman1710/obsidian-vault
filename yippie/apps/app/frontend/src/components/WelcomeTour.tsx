import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Inbox, Users, ClipboardList, Calendar, Kanban, MessageSquare,
  CreditCard, Activity, ChevronRight, X, Package, Megaphone,
  BarChart3, TrendingUp, ArrowRight, FileText, Zap,
  CalendarClock, Sparkles, Languages,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useTenantConfig } from '../App'
import { openQuickCapture } from '../hooks/useQuickCapture'
import { useT } from '../hooks/useT'

// The sidebar-visible modules follow MODULE_MAP top-to-bottom:
// inbox→contacts→tickets→calendar→pipeline→activity→billing→contracts→chat→marketing→tracking→sales→saas→flows
// Their titles mirror the sidebar's labels (i18n) so the tour names the same
// thing the user sees in the nav. Titles/bodies are translation keys resolved
// via useT so the tour renders in the user's chosen language.
//
// A couple of steps cover features with no sidebar entry:
//   - booking: module gated, surfaced via Calendar
//   - ai: the paid AI Inbox add on — gated on the 'ai' module, surfaced via Inbox
//   - Yip: always shown (alwaysShow) — the ⌘K assistant available everywhere.
//     openYip opens the assistant popup instead of navigating to a route.
// (Departments + Roles are onboarded via the SetupChecklist gates, not here.)
const STEP_DEFS: {
  module: string
  titleKey: string
  bodyKey: string
  route: string
  icon: React.ReactNode
  alwaysShow?: boolean
  openYip?: boolean
}[] = [
  { module: 'inbox',     titleKey: 'tour_inbox_title',     bodyKey: 'tour_inbox_body',     route: '/inbox',    icon: <Inbox size={22} className="text-blue-500" /> },
  { module: 'ai',        titleKey: 'tour_ai_title',        bodyKey: 'tour_ai_body',        route: '/inbox',    icon: <Sparkles size={22} className="text-blue-400" /> },
  { module: 'contacts',  titleKey: 'tour_contacts_title',  bodyKey: 'tour_contacts_body',  route: '/contacts', icon: <Users size={22} className="text-violet-500" /> },
  { module: 'tickets',   titleKey: 'tour_tickets_title',   bodyKey: 'tour_tickets_body',   route: '/tickets',  icon: <ClipboardList size={22} className="text-emerald-500" /> },
  { module: 'calendar',  titleKey: 'tour_calendar_title',  bodyKey: 'tour_calendar_body',  route: '/calendar', icon: <Calendar size={22} className="text-orange-500" /> },
  { module: 'booking',   titleKey: 'tour_booking_title',   bodyKey: 'tour_booking_body',   route: '',          icon: <CalendarClock size={22} className="text-rose-500" /> },
  { module: 'pipeline',  titleKey: 'tour_kanban_title',    bodyKey: 'tour_kanban_body',    route: '/pipeline', icon: <Kanban size={22} className="text-pink-500" /> },
  { module: 'activity',  titleKey: 'tour_activity_title',  bodyKey: 'tour_activity_body',  route: '/activity', icon: <Activity size={22} className="text-teal-500" /> },
  { module: 'billing',   titleKey: 'tour_billing_title',   bodyKey: 'tour_billing_body',   route: '/billing',  icon: <CreditCard size={22} className="text-slate-500" /> },
  { module: 'contracts', titleKey: 'tour_contracts_title', bodyKey: 'tour_contracts_body', route: '/contracts', icon: <FileText size={22} className="text-sky-500" /> },
  { module: 'chat',      titleKey: 'tour_chat_title',      bodyKey: 'tour_chat_body',      route: '/chat',     icon: <MessageSquare size={22} className="text-green-500" /> },
  { module: 'marketing', titleKey: 'tour_marketing_title', bodyKey: 'tour_marketing_body', route: '/marketing', icon: <Megaphone size={22} className="text-purple-500" /> },
  { module: 'tracking',  titleKey: 'tour_tracking_title',  bodyKey: 'tour_tracking_body',  route: '/tracking', icon: <Package size={22} className="text-amber-500" /> },
  { module: 'sales',     titleKey: 'tour_sales_title',     bodyKey: 'tour_sales_body',     route: '/sales',    icon: <TrendingUp size={22} className="text-cyan-500" /> },
  { module: 'saas',      titleKey: 'tour_saas_title',      bodyKey: 'tour_saas_body',      route: '/saas',     icon: <BarChart3 size={22} className="text-indigo-500" /> },
  { module: 'flows',     titleKey: 'tour_flows_title',     bodyKey: 'tour_flows_body',     route: '/flows',    icon: <Zap size={22} className="text-fuchsia-500" /> },
  { module: 'yip',       titleKey: 'tour_yip_title',       bodyKey: 'tour_yip_body',       route: '',          icon: <Sparkles size={22} className="text-yippie" />, alwaysShow: true, openYip: true },
]

// Per-user sessionStorage key so the checklist's page reloads (branding save,
// profile save) resume the tour at the same step instead of resetting to 0.
export function tourStepStorageKey(userId: string) {
  return `welcome_tour_step_${userId}`
}

export default function WelcomeTour() {
  const { user, refreshUser } = useAuth()
  const t = useT()
  const storageKey = user ? tourStepStorageKey(user.id) : null
  const [step, setStep] = useState(() => {
    if (!storageKey) return 0
    const saved = Number(sessionStorage.getItem(storageKey))
    return Number.isInteger(saved) && saved > 0 ? saved : 0
  })
  const [minimised, setMinimised] = useState(false)
  const [savingLang, setSavingLang] = useState<string | null>(null)
  const navigate = useNavigate()
  const config = useTenantConfig()

  const enabledModules: string[] = config?.enabled_modules ?? []
  // Fallback while config has no module list: core modules + alwaysShow only.
  // (Never show paid add ons like Tickets here — they are not included by default.)
  const moduleSteps = enabledModules.length > 0
    ? STEP_DEFS.filter(s => s.alwaysShow || enabledModules.includes(s.module))
    : STEP_DEFS.filter(s => s.alwaysShow || s.module === 'inbox' || s.module === 'contacts')

  // The language chooser is always the very first step of a fresh tour, so a new
  // user picks their language before seeing anything else. It renders its own
  // bilingual UI (below) rather than a translated title/body.
  const steps: ({ languageStep: true } | typeof STEP_DEFS[number])[] = [
    { languageStep: true },
    ...moduleSteps,
  ]

  // Persist progress across the reloads some checklist detours trigger.
  useEffect(() => {
    if (storageKey) sessionStorage.setItem(storageKey, String(step))
  }, [step, storageKey])

  const completeMutation = useMutation({
    mutationFn: () => api.patch('/auth/me', { tour_completed: true }).then((r: any) => r.data),
    onSuccess: () => {
      if (storageKey) sessionStorage.removeItem(storageKey)
      refreshUser()
    },
  })

  if (!config) return null

  // Clamp in case a persisted step outlives a shrunken module set.
  const boundedStep = Math.min(step, steps.length - 1)
  const current = steps[boundedStep]
  if (!current) return null

  const isLanguageStep = 'languageStep' in current
  const isLast = boundedStep === steps.length - 1

  function dismiss() { completeMutation.mutate() }

  function next() {
    if (boundedStep < steps.length - 1) setStep(boundedStep + 1)
    else dismiss()
  }

  // Save the picked language immediately, refresh the user so the rest of the
  // tour (and app) re-renders translated, then advance.
  async function chooseLanguage(lang: 'nl' | 'en') {
    setSavingLang(lang)
    try {
      await api.patch('/auth/me', { ui_language: lang })
      await refreshUser()
    } catch { /* keep the picker open on failure */ }
    finally { setSavingLang(null) }
    next()
  }

  // Minimised — just a small pill in the corner
  if (minimised) {
    return (
      <button
        onClick={() => setMinimised(false)}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-full shadow-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-yippie animate-pulse shrink-0" />
        {t('tour_pill')} ({boundedStep + 1}/{steps.length})
      </button>
    )
  }

  return (
    <div className="w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
      {/* Progress strip */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-yippie transition-all duration-300"
          style={{ width: `${((boundedStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="px-5 py-4">
        {/* Dot nav + controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === boundedStep ? 'w-5 bg-yippie' : i < boundedStep ? 'w-2 bg-yippie/40' : 'w-2 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setMinimised(true)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors text-[10px] font-medium px-1.5"
              aria-label={t('tour_minimise')}
              title={t('tour_minimise')}
            >
              –
            </button>
            <button
              onClick={dismiss}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label={t('tour_skip')}
              title={t('tour_skip')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {isLanguageStep ? (
          /* Language chooser — intentionally bilingual, shown before any language
             is committed. Picking one saves it and moves on. */
          <div>
            <div className="flex items-start gap-3 mb-4">
              <div className="shrink-0 mt-0.5"><Languages size={22} className="text-yippie" /></div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm leading-tight mb-1">Choose your language · Kies je taal</h2>
                <p className="text-xs text-slate-500 leading-relaxed">Pick the language for the app. You can change it any time in your profile. · Kies de taal voor de app. Je kunt dit altijd aanpassen in je profiel.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => chooseLanguage('nl')}
                disabled={savingLang !== null}
                className="flex flex-col items-center gap-1 px-3 py-3 border border-slate-200 rounded-xl hover:border-yippie hover:bg-yippie/5 transition-colors disabled:opacity-50"
              >
                <span className="text-lg">🇳🇱</span>
                <span className="text-xs font-semibold text-slate-800">Nederlands</span>
              </button>
              <button
                onClick={() => chooseLanguage('en')}
                disabled={savingLang !== null}
                className="flex flex-col items-center gap-1 px-3 py-3 border border-slate-200 rounded-xl hover:border-yippie hover:bg-yippie/5 transition-colors disabled:opacity-50"
              >
                <span className="text-lg">🇬🇧</span>
                <span className="text-xs font-semibold text-slate-800">English</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Content */}
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">{current.icon}</div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm leading-tight mb-1">{t(current.titleKey)}</h2>
                <p className="text-xs text-slate-500 leading-relaxed">{t(current.bodyKey)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4">
              {(current.route || current.openYip) ? (
                <button
                  onClick={() => current.openYip ? openQuickCapture() : navigate(current.route)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowRight size={12} />
                  {t('tour_open')} {t(current.titleKey)}
                </button>
              ) : <span />}
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-yippie hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-opacity"
              >
                {isLast ? t('tour_get_started') : t('tour_next')}
                {!isLast && <ChevronRight size={13} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
