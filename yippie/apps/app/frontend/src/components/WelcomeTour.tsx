import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Inbox, Users, ClipboardList, Calendar, Kanban, MessageSquare,
  CreditCard, Activity, ChevronRight, X, Package, Megaphone,
  BarChart3, TrendingUp, ArrowRight, FileText, Zap,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useTenantConfig } from '../App'

// Order must match sidebar MODULE_MAP top-to-bottom:
// inbox→contacts→tickets→calendar→pipeline→activity→billing→contracts→chat→marketing→tracking→sales→saas→flows
// Titles must match the sidebar's English labels (i18n/translations.ts) so the
// tour names the same thing the user sees in the nav.
const STEP_DEFS: {
  module: string
  title: string
  body: string
  route: string
  icon: React.ReactNode
}[] = [
  {
    module: 'inbox',
    title: 'Your Inbox',
    body: 'Incoming mail and WhatsApp messages land here. AI can draft a ticket for each one. Review and approve with one click.',
    route: '/inbox',
    icon: <Inbox size={22} className="text-blue-500" />,
  },
  {
    module: 'contacts',
    title: 'Contacts',
    body: 'Every customer in one place. Link contacts to tickets, track pipeline progress, and see the full conversation history.',
    route: '/contacts',
    icon: <Users size={22} className="text-violet-500" />,
  },
  {
    module: 'tickets',
    title: 'Tickets',
    body: 'Open issues, SLA timers, and status at a glance. Assign, snooze, or escalate. Or let automation handle the follow-up.',
    route: '/tickets',
    icon: <ClipboardList size={22} className="text-emerald-500" />,
  },
  {
    module: 'calendar',
    title: 'Calendar',
    body: 'Schedule follow-ups, meetings, and deadlines. Events sync with your tickets and contacts automatically.',
    route: '/calendar',
    icon: <Calendar size={22} className="text-orange-500" />,
  },
  {
    module: 'pipeline',
    title: 'Kanban',
    body: 'Visualise your workflow with drag-and-drop Kanban stages. Move contacts forward and track deals in real time.',
    route: '/pipeline',
    icon: <Kanban size={22} className="text-pink-500" />,
  },
  {
    module: 'activity',
    title: 'Activity',
    body: 'A full audit trail of everything your team has done: replies, ticket updates, pipeline moves, and more.',
    route: '/activity',
    icon: <Activity size={22} className="text-teal-500" />,
  },
  {
    module: 'billing',
    title: 'Billing',
    body: 'Manage invoices, track payment status, and export your financials. All in one place.',
    route: '/billing',
    icon: <CreditCard size={22} className="text-slate-500" />,
  },
  {
    module: 'contracts',
    title: 'Contracts',
    body: 'Manage the full contract lifecycle: draft, send for e-signing, and track renewals. Customers sign online with a draw-to-sign page.',
    route: '/contracts',
    icon: <FileText size={22} className="text-sky-500" />,
  },
  {
    module: 'chat',
    title: 'Live Chat',
    body: 'Handle WhatsApp conversations in real time. Assign sessions to agents, use canned responses, and convert chats to tickets.',
    route: '/chat',
    icon: <MessageSquare size={22} className="text-green-500" />,
  },
  {
    module: 'marketing',
    title: 'Marketing',
    body: 'Send campaigns, track opens and clicks, and build email templates with a drag-and-drop editor.',
    route: '/marketing',
    icon: <Megaphone size={22} className="text-purple-500" />,
  },
  {
    module: 'tracking',
    title: 'Tracking',
    body: 'Connect Sendcloud to monitor shipments and share tracking links with customers automatically.',
    route: '/tracking',
    icon: <Package size={22} className="text-amber-500" />,
  },
  {
    module: 'sales',
    title: 'Sales',
    body: 'Track revenue, monitor sales performance, and see which deals are moving through your pipeline.',
    route: '/sales',
    icon: <TrendingUp size={22} className="text-cyan-500" />,
  },
  {
    module: 'saas',
    title: 'Product Analytics',
    body: 'Monitor user engagement, retention, and feature adoption across your product.',
    route: '/saas',
    icon: <BarChart3 size={22} className="text-indigo-500" />,
  },
  {
    module: 'flows',
    title: 'Flows',
    body: 'Build no-code automations with triggers, SLA escalation, and webhooks. Set a flow live and let it handle the routine work.',
    route: '/flows',
    icon: <Zap size={22} className="text-fuchsia-500" />,
  },
]

// Per-user sessionStorage key so the checklist's page reloads (branding save,
// profile save) resume the tour at the same step instead of resetting to 0.
export function tourStepStorageKey(userId: string) {
  return `welcome_tour_step_${userId}`
}

export default function WelcomeTour() {
  const { user, refreshUser } = useAuth()
  const storageKey = user ? tourStepStorageKey(user.id) : null
  const [step, setStep] = useState(() => {
    if (!storageKey) return 0
    const saved = Number(sessionStorage.getItem(storageKey))
    return Number.isInteger(saved) && saved > 0 ? saved : 0
  })
  const [minimised, setMinimised] = useState(false)
  const navigate = useNavigate()
  const config = useTenantConfig()

  const enabledModules: string[] = config?.enabled_modules ?? []
  const steps = enabledModules.length > 0
    ? STEP_DEFS.filter(s => enabledModules.includes(s.module))
    : STEP_DEFS.slice(0, 3)

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

  const isLast = boundedStep === steps.length - 1

  function dismiss() { completeMutation.mutate() }

  function next() {
    if (boundedStep < steps.length - 1) setStep(boundedStep + 1)
    else dismiss()
  }

  // Minimised — just a small pill in the corner
  if (minimised) {
    return (
      <button
        onClick={() => setMinimised(false)}
        className="flex items-center gap-2 bg-white border border-slate-200 rounded-full shadow-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-yippie animate-pulse shrink-0" />
        Tour ({boundedStep + 1}/{steps.length})
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
              aria-label="Minimise"
              title="Minimise"
            >
              –
            </button>
            <button
              onClick={dismiss}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Skip tour"
              title="Skip tour"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">{current.icon}</div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm leading-tight mb-1">{current.title}</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{current.body}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => navigate(current.route)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowRight size={12} />
            Open {current.title}
          </button>
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-yippie hover:opacity-90 text-white text-xs font-semibold rounded-xl transition-opacity"
          >
            {isLast ? 'Get started' : 'Next'}
            {!isLast && <ChevronRight size={13} />}
          </button>
        </div>
      </div>
    </div>
  )
}
