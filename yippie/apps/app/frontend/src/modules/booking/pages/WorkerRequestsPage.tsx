import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LogOut, CalendarClock, Inbox } from 'lucide-react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

interface Slot { start: string; end: string }
interface OpenRequest {
  id: string
  contact_first_name: string | null
  requested_slots: Slot[]
  message: string | null
  created_at: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function WorkerRequestsPage() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()

  const { data: requests = [], isLoading } = useQuery<OpenRequest[]>({
    queryKey: ['worker-requests'],
    queryFn: () => api.get('/worker/requests').then((r: any) => r.data),
    refetchInterval: 20000, // keep the job board fresh
  })

  const claimMut = useMutation({
    mutationFn: ({ id, slot }: { id: string; slot: Slot }) =>
      api.post(`/worker/requests/${id}/claim`, { slot_start: slot.start, slot_end: slot.end }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-requests'] })
      toast.success('Job claimed — added to your schedule')
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Could not claim — it may be taken'),
  })

  const firstName = (user?.full_name || 'there').split(' ')[0]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto w-full px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-yippie flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-white" strokeWidth={2.2} />
            </div>
            <span className="font-display text-lg font-bold text-ink tracking-tight">Open requests</span>
          </div>
          <button onClick={() => logout()} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-5 py-6">
        <h1 className="font-display text-2xl font-bold text-ink tracking-tight">Hi {firstName} 👋</h1>
        <p className="text-sm text-slate-500 mt-1">Claim a job by picking one of the customer's preferred times.</p>

        {isLoading ? (
          <p className="text-sm text-slate-400 mt-6">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="mt-10 text-center text-slate-400">
            <Inbox className="h-10 w-10 mx-auto mb-3" />
            <p className="text-sm">No open requests right now. Check back soon.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {requests.map(r => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-sm font-semibold text-ink">
                    {r.contact_first_name || 'A customer'}
                  </span>
                  <span className="text-xs text-slate-400">requested {fmt(r.created_at)}</span>
                </div>
                {r.message && <p className="text-sm text-slate-600 mt-1.5">{r.message}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.requested_slots.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => claimMut.mutate({ id: r.id, slot: s })}
                      disabled={claimMut.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-sm font-semibold rounded-lg border border-brand-100 transition-colors disabled:opacity-50"
                    >
                      Claim {fmt(s.start)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
