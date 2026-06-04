import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Mail, MessageSquare, ArrowRight } from 'lucide-react'
import { api } from '../../../api/client'

const SOURCE_ICON: Record<string, React.ReactNode> = {
  email: <Mail size={13} className="text-slate-400" />,
  whatsapp: <MessageSquare size={13} className="text-green-500" />,
}

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-amber-100 text-amber-700',
  medium: 'bg-blue-100 text-blue-700',
  low:    'bg-slate-100 text-slate-600',
}

const STATUS_STYLES: Record<string, string> = {
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  forwarded: 'bg-violet-100 text-violet-700',
}

type Tab = 'pending' | 'processed'

export default function InboxQueue() {
  const [activeTab, setActiveTab] = useState<Tab>('pending')

  const { data: pendingDrafts, isLoading: pendingLoading } = useQuery({
    queryKey: ['drafts', 'pending'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'pending' } }).then(r => r.data),
    refetchInterval: 15_000,
    enabled: activeTab === 'pending',
  })

  const { data: approvedDrafts } = useQuery({
    queryKey: ['drafts', 'approved'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'approved' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: rejectedDrafts } = useQuery({
    queryKey: ['drafts', 'rejected'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'rejected' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const { data: forwardedDrafts } = useQuery({
    queryKey: ['drafts', 'forwarded'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'forwarded' } }).then(r => r.data),
    enabled: activeTab === 'processed',
  })

  const processedDrafts = [...(approvedDrafts ?? []), ...(rejectedDrafts ?? []), ...(forwardedDrafts ?? [])]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const drafts = activeTab === 'pending' ? pendingDrafts : processedDrafts
  const isLoading = activeTab === 'pending' ? pendingLoading : false

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inbox</h1>
        <p className="text-sm text-slate-500 mt-0.5">Review AI-generated drafts from email and WhatsApp</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['pending', 'processed'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {!isLoading && (!drafts || drafts.length === 0) && (
        <div className="py-12 text-center bg-white rounded-xl border border-slate-200">
          <Mail size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">
            {activeTab === 'pending' ? 'No pending messages' : 'No processed messages yet'}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {drafts?.map((d: any) => {
          const isFollowUp = d.status === 'approved' && d.follow_up_at
          return (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {SOURCE_ICON[d.source] ?? <Mail size={13} className="text-slate-400" />}
                  <span className="text-sm font-semibold text-slate-900">{d.ai_suggested_subject}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${PRIORITY_STYLES[d.ai_suggested_priority]}`}>
                    {d.ai_suggested_priority}
                  </span>
                  {d.ai_suggested_category && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                      {d.ai_suggested_category}
                    </span>
                  )}
                  {d.status !== 'pending' && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[d.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {d.status}
                    </span>
                  )}
                  {isFollowUp && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      Follow-up
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-1 line-clamp-2">
                  {d.ai_suggested_description?.slice(0, 120)}…
                </p>
                <p className="text-xs text-slate-400">{new Date(d.created_at).toLocaleString()}</p>
              </div>
              <Link
                to={`/inbox/drafts/${d.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
              >
                {activeTab === 'processed' ? 'Open' : 'Review'}
                <ArrowRight size={12} />
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
