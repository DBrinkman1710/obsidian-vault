import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Lock } from 'lucide-react'
import { api } from '../../../api/client'

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting', 'resolved', 'closed']

const STATUS_STYLES: Record<string, string> = {
  open:        'bg-blue-600 text-white border-blue-600',
  in_progress: 'bg-amber-500 text-white border-amber-500',
  waiting:     'bg-violet-600 text-white border-violet-600',
  resolved:    'bg-green-600 text-white border-green-600',
  closed:      'bg-slate-500 text-white border-slate-500',
}

const STATUS_INACTIVE = 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)

  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
  })
  const { data: comments } = useQuery({
    queryKey: ['ticket-comments', id],
    queryFn: () => api.get(`/tickets/${id}/comments`).then(r => r.data),
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/tickets/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  })

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/comments`, { body: comment, is_internal: isInternal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-comments', id] })
      setComment('')
    },
  })

  if (!ticket) return <p className="text-sm text-slate-400">Loading…</p>

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900 mb-2">{ticket.subject}</h1>

      <div className="flex gap-3 mb-6 text-sm text-slate-600">
        <span>Status: <strong className="text-slate-900">{ticket.status}</strong></span>
        <span>Priority: <strong className="text-slate-900">{ticket.priority}</strong></span>
        <span>Source: <strong className="text-slate-900">{ticket.source}</strong></span>
      </div>

      {ticket.description && (
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-200">
          {ticket.description}
        </p>
      )}

      <div className="flex gap-2 mb-8 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => statusMutation.mutate(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize ${ticket.status === s ? STATUS_STYLES[s] : STATUS_INACTIVE}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Comments</h3>

      <div className="flex flex-col gap-3 mb-6">
        {comments?.map((c: any) => (
          <div key={c.id} className={`rounded-xl border p-4 ${c.is_internal ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}>
            {c.is_internal && (
              <div className="flex items-center gap-1.5 mb-2">
                <Lock size={11} className="text-amber-600" />
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Internal note</p>
              </div>
            )}
            <p className="text-sm text-slate-900 whitespace-pre-wrap">{c.body}</p>
            <p className="text-xs text-slate-400 mt-2">{new Date(c.created_at).toLocaleString()}</p>
          </div>
        ))}
        {(!comments || comments.length === 0) && (
          <p className="text-sm text-slate-400">No comments yet.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Write a reply or note…"
          rows={4}
          className="w-full text-sm text-slate-900 resize-none focus:outline-none placeholder-slate-400"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={e => setIsInternal(e.target.checked)}
              className="rounded border-slate-300"
            />
            <Lock size={12} className="text-slate-400" />
            Internal note
          </label>
          <button
            onClick={() => commentMutation.mutate()}
            disabled={!comment.trim() || commentMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            <Send size={13} />
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
