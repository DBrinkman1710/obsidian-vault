import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Inbox, Users, ClipboardList, Calendar, Kanban, MessageSquare,
  CreditCard, Activity, ChevronRight, X, Package, Megaphone,
  BarChart3, TrendingUp,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useTenantConfig } from '../App'

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
    body: 'All incoming mail and WhatsApp messages land here. AI drafts a ticket for each one — review and approve with one click.',
    route: '/inbox',
    icon: <Inbox size={26} className="text-blue-500" />,
  },
  {
    module: 'contacts',
    title: 'Contacts',
    body: 'Every customer in one place. Link contacts to tickets, track pipeline progress, and see the full conversation history.',
    route: '/contacts',
    icon: <Users size={26} className="text-violet-500" />,
  },
  {
    module: 'tickets',
    title: 'Tickets',
    body: 'Open issues, SLA timers, and status at a glance. Assign, snooze, or escalate — or let automation handle the follow-up.',
    route: '/tickets',
    icon: <ClipboardList size={26} className="text-emerald-500" />,
  },
  {
    module: 'pipeline',
    title: 'Pipeline',
    body: 'Visualise your workflow with drag-and-drop Kanban stages. Move contacts forward and track deals in real time.',
    route: '/pipeline',
    icon: <Kanban size={26} className="text-pink-500" />,
  },
  {
    module: 'chat',
    title: 'Live Chat',
    body: 'Handle WhatsApp conversations in real time. Assign sessions to agents, use canned responses, and convert chats to tickets.',
    route: '/chat',
    icon: <MessageSquare size={26} className="text-green-500" />,
  },
  {
    module: 'calendar',
    title: 'Calendar',
    body: 'Schedule follow-ups, meetings, and deadlines. Events sync with your tickets and contacts automatically.',
    route: '/calendar',
    icon: <Calendar size={26} className="text-orange-500" />,
  },
  {
    module: 'marketing',
    title: 'Marketing',
    body: 'Send campaigns, track opens and clicks, and build email templates with a drag-and-drop editor.',
    route: '/marketing',
    icon: <Megaphone size={26} className="text-purple-500" />,
  },
  {
    module: 'billing',
    title: 'Billing',
    body: 'Manage invoices, track payment status, and export your financials — all in one place.',
    route: '/billing',
    icon: <CreditCard size={26} className="text-slate-500" />,
  },
  {
    module: 'tracking',
    title: 'Track & Trace',
    body: 'Connect Sendcloud to monitor shipments and share tracking links with customers automatically.',
    route: '/tracking',
    icon: <Package size={26} className="text-amber-500" />,
  },
  {
    module: 'activity',
    title: 'Activity Log',
    body: 'A full audit trail of everything your team has done — replies, ticket updates, pipeline moves, and more.',
    route: '/activity',
    icon: <Activity size={26} className="text-teal-500" />,
  },
  {
    module: 'sales',
    title: 'Sales Dashboard',
    body: 'Track revenue, monitor sales performance, and see which deals are moving through your pipeline.',
    route: '/sales',
    icon: <TrendingUp size={26} className="text-cyan-500" />,
  },
  {
    module: 'saas',
    title: 'Product Analytics',
    body: 'Monitor user engagement, retention, and feature adoption across your product.',
    route: '/saas',
    icon: <BarChart3 size={26} className="text-indigo-500" />,
  },
]

export default function WelcomeTour() {
  const [step, setStep] = useState(0)
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const config = useTenantConfig()

  // Wait for config so we show the right steps for this tenant's modules.
  const enabledModules: string[] = config?.enabled_modules ?? []
  const isDemo = config?.is_demo ?? false

  const steps = enabledModules.length > 0
    ? STEP_DEFS.filter(s => enabledModules.includes(s.module))
    : STEP_DEFS.slice(0, 3) // safe fallback while config loads

  const completeMutation = useMutation({
    mutationFn: () => api.patch('/auth/me', { tour_completed: true }).then(r => r.data),
    onSuccess: () => refreshUser(),
  })

  // Navigate to the current step's route whenever the step changes.
  // Guard on config so we never navigate with the fallback steps — wait until
  // the real module list is known before touching the router.
  useEffect(() => {
    if (!config) return
    if (steps[step]) navigate(steps[step].route)
  }, [step, config]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() { completeMutation.mutate() }

  function next() {
    if (step < steps.length - 1) setStep(s => s + 1)
    else dismiss()
  }

  if (!config) return null

  const current = steps[step]
  if (!current) return null
  const isLast = step === steps.length - 1

  // ── Demo: non-blocking floating card ──────────────────────────────────
  if (isDemo) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Progress strip */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-yippie transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="px-5 py-4">
          {/* Dots + dismiss */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-5 bg-yippie' : i < step ? 'w-2 bg-yippie/40' : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={dismiss}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Skip tour"
            >
              <X size={14} />
            </button>
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
            <p className="text-xs text-slate-400">{step + 1} / {steps.length}</p>
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

  // ── Non-demo: center modal with backdrop ──────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-blue-500' : i < step ? 'w-3 bg-blue-200' : 'w-3 bg-slate-200'
                }`}
              />
            ))}
          </div>
          <button
            onClick={dismiss}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Skip tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-8 text-center">
          <div className="flex justify-center mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{current.title}</h2>
          <p className="text-sm text-slate-500 leading-relaxed">{current.body}</p>
        </div>

        {/* Action */}
        <div className="px-6 pb-6 flex items-center justify-center">
          <button
            onClick={next}
            className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {isLast ? 'Get started' : 'Next'}
            {!isLast && <ChevronRight size={15} />}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          {step + 1} of {steps.length}
        </p>
      </div>
    </div>
  )
}
