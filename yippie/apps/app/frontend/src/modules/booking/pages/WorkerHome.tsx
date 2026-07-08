import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

interface WorkerContext {
  booking_direction: string
  request_fulfillment: string
}

/**
 * Landing for the worker shell — routes to the right screen based on the
 * tenant's booking direction. In requests + dispatcher mode there's nothing for
 * the worker to do, so we show a short message.
 */
export default function WorkerHome() {
  const { data, isLoading } = useQuery<WorkerContext>({
    queryKey: ['worker-context'],
    queryFn: () => api.get('/worker/context').then((r: any) => r.data),
  })

  if (isLoading || !data) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-400">Loading…</div>
  }

  if (data.booking_direction === 'requests') {
    if (data.request_fulfillment === 'self_claim') {
      return <Navigate to="/requests" replace />
    }
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div>
          <p className="font-display text-lg font-bold text-ink">You're all set</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm">
            Your dispatcher assigns jobs to you — they'll appear on your calendar. Nothing to do here for now.
          </p>
        </div>
      </div>
    )
  }

  return <Navigate to="/availability" replace />
}
