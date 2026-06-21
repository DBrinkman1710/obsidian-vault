import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Megaphone, Plus, X, Mail, MessageCircle } from 'lucide-react'
import { Campaign, CampaignStatus, Channel, marketingApi } from './api'
import { CampaignDetail } from './CampaignDetail'

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  sending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function NewCampaignModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Campaign) => void }) {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [channel, setChannel] = useState<Channel>('email')

  const create = useMutation({
    mutationFn: () => marketingApi.createCampaign({ name: name.trim(), subject: subject.trim(), dispatch_channel: channel }),
    onSuccess: (c) => {
      toast.success('Campaign created')
      onCreated(c)
    },
    onError: () => toast.error('Could not create campaign'),
  })

  const valid = name.trim().length > 0 && subject.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">New campaign</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Spring re-engagement"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject line</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="We've missed you — here's 25% off"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Channel</label>
        <div className="mb-6 grid grid-cols-2 gap-2">
          {(['email', 'whatsapp'] as Channel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                channel === c ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c === 'email' ? <Mail size={15} /> : <MessageCircle size={15} />}
              {c}
            </button>
          ))}
        </div>
        <button
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
    </div>
  )
}

export default function MarketingPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn: marketingApi.listCampaigns,
  })

  const selected = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? null,
    [campaigns, selectedId],
  )

  function handleCreated(c: Campaign) {
    qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
    setSelectedId(c.id)
    setShowNew(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — campaign list */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-blue-600" />
            <h1 className="text-sm font-bold tracking-tight text-slate-900">Marketing</h1>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={14} /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="px-2 py-4 text-sm text-slate-400">Loading…</p>
          ) : campaigns.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-slate-600">No campaigns yet</p>
              <p className="mt-1 text-xs text-slate-400">Create your first campaign to reach your contacts.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      selectedId === c.id
                        ? 'border-blue-200 bg-blue-50/60'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{c.name}</span>
                      {c.dispatch_channel === 'whatsapp' ? (
                        <MessageCircle size={13} className="shrink-0 text-emerald-500" />
                      ) : (
                        <Mail size={13} className="shrink-0 text-slate-400" />
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{c.subject}</p>
                    <div className="mt-1.5">
                      <StatusBadge status={c.status} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Right — detail */}
      <main className="flex-1 overflow-hidden bg-slate-50">
        {selected ? (
          <CampaignDetail campaign={selected} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Megaphone size={36} className="text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">Select a campaign</p>
            <p className="mt-1 text-xs text-slate-400">or create a new one to get started.</p>
          </div>
        )}
      </main>

      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}
    </div>
  )
}
