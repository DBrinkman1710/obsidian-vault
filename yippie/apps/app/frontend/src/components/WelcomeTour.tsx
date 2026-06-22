import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Inbox, Users, Ticket, Settings, ChevronRight, X } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'

const STEPS = [
  {
    icon: <Inbox size={28} className="text-blue-500" />,
    title: 'Your inbox',
    body: 'All incoming mail and WhatsApp messages land here. AI drafts a ticket for each one — you review and approve with one click.',
    route: '/inbox',
  },
  {
    icon: <Users size={28} className="text-violet-500" />,
    title: 'Contacts',
    body: 'Every customer in one place. Link contacts to tickets, track your pipeline, and see the full conversation history at a glance.',
    route: '/contacts',
  },
  {
    icon: <Ticket size={28} className="text-emerald-500" />,
    title: 'Tickets',
    body: 'Open issues, SLA timers, and status at a glance. Assign, snooze, escalate — or let automation handle it.',
    route: '/tickets',
  },
  {
    icon: <Settings size={28} className="text-slate-400" />,
    title: 'Set up your email',
    body: 'Add a personal inbox address in your Profile so mail reaches you directly and you can reply from your own address.',
    route: '/settings/profile',
  },
]

export default function WelcomeTour() {
  const [step, setStep] = useState(0)
  const { refreshUser } = useAuth()
  const navigate = useNavigate()

  const completeMutation = useMutation({
    mutationFn: () => api.patch('/auth/me', { tour_completed: true }).then(r => r.data),
    onSuccess: () => refreshUser(),
  })

  function dismiss() {
    completeMutation.mutate()
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      dismiss()
    }
  }

  function goTo(route: string) {
    dismiss()
    navigate(route)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-5 pb-0">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-blue-500' : i < step ? 'w-3 bg-blue-200' : 'w-3 bg-slate-200'}`}
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

        {/* Actions */}
        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            onClick={() => goTo(current.route)}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-sm font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Show me
          </button>
          <button
            onClick={next}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {isLast ? 'Get started' : 'Next'}
            {!isLast && <ChevronRight size={15} />}
          </button>
        </div>

        {/* Step label */}
        <p className="text-center text-xs text-slate-400 pb-4">
          {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  )
}
