import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../auth/useAuth'
import { useTenantConfig } from '../App'
import YipTrainModal from './YipTrainModal'

interface Gate {
  id: string
  label: string
  detail: string
  route?: string
  action?: () => void
  done: boolean
}

export default function SetupChecklist() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const config = useTenantConfig()
  const [collapsed, setCollapsed] = useState(false)
  const [showYipTrain, setShowYipTrain] = useState(false)
  const [yipTrainDone, setYipTrainDone] = useState(false)

  const isAdmin = user?.role === 'admin'

  const teamQuery = useQuery({
    queryKey: ['setup-team-count'],
    queryFn: () => api.get('/team/users').then((r: any) => r.data as { id: string }[]),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
  })

  const ticketQuery = useQuery({
    queryKey: ['setup-closed-ticket'],
    queryFn: () => api.get('/tickets', { params: { status: 'closed', limit: 1 } }).then((r: any) => r.data as { items: { id: string }[]; total: number }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user && !!user.tour_completed && !user.setup_checklist_dismissed,
  })

  const gates: Gate[] = [
    {
      id: 'email',
      label: 'Connect your email',
      detail: 'Add a personal address so you can send and receive mail directly.',
      route: '/settings/profile',
      done: !!user?.reply_from_email,
    },
    ...(isAdmin ? [{
      id: 'team',
      label: 'Invite your team',
      detail: 'Teammates get their own login and can claim tickets.',
      route: '/settings/team',
      done: (teamQuery.data?.length ?? 0) > 1,
    }] : []),
    {
      id: 'ticket',
      label: 'Handle your first ticket',
      detail: 'Go to Inbox, approve a draft — it becomes a ticket.',
      route: '/inbox',
      done: (ticketQuery.data?.total ?? 0) > 0,
    },
    ...(isAdmin ? [{
      id: 'yip-train',
      label: 'Train Yip',
      detail: 'Help Yip learn your business so AI replies fit your brand.',
      action: () => setShowYipTrain(true),
      done: yipTrainDone || !!(config?.ai_profile),
    }] : []),
  ]

  const completedCount = gates.filter(g => g.done).length
  const allDone = completedCount === gates.length

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

  if (!user?.tour_completed || user?.setup_checklist_dismissed) return null
  // Only show while data is loading or there's something to do
  if (ticketQuery.isLoading || (isAdmin && teamQuery.isLoading)) return null

  return (
    <>
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {allDone ? 'All done!' : 'Get started'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {allDone ? 'Your workspace is ready.' : `${completedCount} of ${gates.length} complete`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          <button
            onClick={() => dismissMutation.mutate()}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-full bg-yippie transition-all duration-500"
          style={{ width: `${(completedCount / gates.length) * 100}%` }}
        />
      </div>

      {/* Gate list */}
      {!collapsed && (
        <ul className="divide-y divide-slate-50">
          {gates.map(gate => (
            <li key={gate.id}>
              <button
                disabled={gate.done}
                onClick={() => {
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
    </>
  )
}
