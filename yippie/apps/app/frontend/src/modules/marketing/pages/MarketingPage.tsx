import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BarChart2, Calendar, Copy, GitBranch, Megaphone, Pencil, Plus, Trash2, UserMinus, Users, X, Mail, MessageCircle, Zap } from 'lucide-react'
import { Campaign, CampaignStatus, Channel, marketingApi, Unsubscribe } from '../api'
import { CampaignDetail, TabKey } from './CampaignDetail'

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
  const [subjectEdited, setSubjectEdited] = useState(false)
  const [channel, setChannel] = useState<Channel>('email')

  const create = useMutation({
    mutationFn: () => marketingApi.createCampaign({ name: name.trim(), subject: subject.trim(), dispatch_channel: channel }),
    onSuccess: (c: any) => {
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
          onChange={(e) => { setName(e.target.value); if (!subjectEdited) setSubject(e.target.value) }}
          placeholder="Spring re-engagement"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        />
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subject line</label>
        <input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setSubjectEdited(true) }}
          placeholder="We've missed you. Here's 25% off."
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
          className="w-full rounded-xl bg-yippie py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {create.isPending ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
    </div>
  )
}

function UnsubscribesPanel() {
  const qc = useQueryClient()
  const { data: list = [], isLoading } = useQuery<Unsubscribe[]>({
    queryKey: ['marketing', 'unsubscribes'],
    queryFn: marketingApi.listUnsubscribes,
  })
  const reenable = useMutation({
    mutationFn: (id: string) => marketingApi.removeUnsubscribe(id),
    onSuccess: () => {
      toast.success('Re-enabled')
      qc.invalidateQueries({ queryKey: ['marketing', 'unsubscribes'] })
    },
    onError: () => toast.error('Could not re-enable'),
  })
  if (isLoading) return <div className="p-6 text-sm text-slate-400">Loading…</div>
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Opted-out contacts</h2>
        {list.length === 0 ? (
          <p className="text-sm text-slate-400">No opt-outs yet.</p>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Campaign</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {list.map((u: any) => (
                  <tr key={u.contact_id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{u.contact_name ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{u.contact_email ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(u.unsubscribed_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{u.campaign_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => {
                          if (confirm('Re-enable this contact for future campaigns?')) reenable.mutate(u.contact_id)
                        }}
                        className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                      >
                        Re-enable
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  )
}

type ContextMenu = { x: number; y: number; campaign: Campaign }

const CONTEXT_ITEMS: { tab: TabKey; label: string; icon: React.ReactNode }[] = [
  { tab: 'design',    label: 'Edit design',     icon: <Pencil size={13} /> },
  { tab: 'actions',   label: 'Actions',          icon: <Zap size={13} /> },
  { tab: 'audience',  label: 'Audience',         icon: <Users size={13} /> },
  { tab: 'schedule',  label: 'Schedule',         icon: <Calendar size={13} /> },
  { tab: 'analytics', label: 'Analytics',        icon: <BarChart2 size={13} /> },
  { tab: 'drip',      label: 'Drip sequences',   icon: <GitBranch size={13} /> },
]

export default function MarketingPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<TabKey>('design')
  const [showNew, setShowNew] = useState(false)
  const [view, setView] = useState<'campaigns' | 'unsubscribes'>('campaigns')
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn: marketingApi.listCampaigns,
  })

  const { data: stats } = useQuery({
    queryKey: ['marketing', 'stats'],
    queryFn: () => marketingApi.getStats(30),
  })

  const duplicate = useMutation({
    mutationFn: (id: string) => marketingApi.duplicateCampaign(id),
    onSuccess: (c: any) => {
      toast.success('Campaign duplicated')
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
      setSelectedId(c.id)
    },
    onError: () => toast.error('Could not duplicate'),
  })

  const deleteCampaign = useMutation({
    mutationFn: (id: string) => marketingApi.deleteCampaign(id),
    onSuccess: () => {
      toast.success('Campaign deleted')
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
      if (selectedId === contextMenu?.campaign.id) setSelectedId(null)
    },
    onError: () => toast.error('Only draft campaigns can be deleted.'),
  })

  useEffect(() => {
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    if (contextMenu) document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [contextMenu])

  const selected = useMemo(
    () => campaigns.find((c: any) => c.id === selectedId) ?? null,
    [campaigns, selectedId],
  )

  function handleCreated(c: Campaign) {
    qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
    setSelectedId(c.id)
    setShowNew(false)
  }

  function openContextMenu(e: React.MouseEvent, campaign: Campaign) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, campaign })
  }

  function selectTab(campaign: Campaign, tab: TabKey) {
    setView('campaigns')
    setSelectedId(campaign.id)
    setSelectedTab(tab)
    setContextMenu(null)
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
            className="flex items-center gap-1 rounded-lg bg-yippie px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> New
          </button>
        </div>

        {/* View tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setView('campaigns')}
            className={`flex-1 py-2 text-xs font-semibold transition-colors ${view === 'campaigns' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Campaigns
          </button>
          <button
            onClick={() => setView('unsubscribes')}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${view === 'unsubscribes' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <UserMinus size={12} /> Opt-outs
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {view === 'unsubscribes' ? null : isLoading ? (
            <p className="px-2 py-4 text-sm text-slate-400">Loading…</p>
          ) : campaigns.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-subtle)' }}>
                <Megaphone size={22} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
              </div>
              <p className="text-sm font-medium text-slate-600">No campaigns yet</p>
              <p className="mt-1 text-xs text-slate-400">Create your first campaign to reach your contacts.</p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                <Plus size={14} strokeWidth={2.5} /> New campaign
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {campaigns.map((c: any) => (
                <li key={c.id} onContextMenu={(e) => openContextMenu(e, c)}>
                  <button
                    onClick={() => { setView('campaigns'); setSelectedId(c.id) }}
                    className={`group w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      selectedId === c.id && view === 'campaigns'
                        ? 'border-blue-200 bg-blue-50/60'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{c.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); duplicate.mutate(c.id) }}
                          title="Duplicate"
                          className="rounded p-0.5 text-slate-300 opacity-0 transition-opacity hover:text-slate-600 group-hover:opacity-100"
                        >
                          <Copy size={12} />
                        </button>
                        {c.dispatch_channel === 'whatsapp' ? (
                          <MessageCircle size={13} className="text-emerald-500" />
                        ) : (
                          <Mail size={13} className="text-slate-400" />
                        )}
                      </div>
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
        {view === 'unsubscribes' ? (
          <UnsubscribesPanel />
        ) : (
          <>
            {/* KPI strip */}
            {stats && (
              <div className="grid grid-cols-4 gap-3 border-b border-slate-200 bg-white px-6 py-3">
                {[
                  { label: 'Sent (30d)', value: stats.campaigns_sent },
                  { label: 'Open rate', value: `${stats.open_rate}%` },
                  { label: 'Response rate', value: `${stats.response_rate}%` },
                  { label: 'Total opt-outs', value: stats.total_opt_outs },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-xs text-slate-400">{s.label}</p>
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="h-[calc(100%-56px)] overflow-hidden">
              {selected ? (
                <CampaignDetail
                  campaign={selected}
                  onDeleted={() => setSelectedId(null)}
                  activeTab={selectedTab}
                  onTabChange={setSelectedTab}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Megaphone size={36} className="text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-500">Select a campaign</p>
                  <p className="mt-1 text-xs text-slate-400">or create a new one to get started.</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {showNew && <NewCampaignModal onClose={() => setShowNew(false)} onCreated={handleCreated} />}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {CONTEXT_ITEMS.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => selectTab(contextMenu.campaign, tab)}
              disabled={tab === 'analytics' && contextMenu.campaign.status !== 'sending' && contextMenu.campaign.status !== 'completed'}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            >
              <span className="text-slate-400">{icon}</span>
              {label}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => {
              if (contextMenu.campaign.status !== 'draft') {
                toast.error('Only draft campaigns can be deleted.')
                setContextMenu(null)
                return
              }
              if (confirm(`Delete "${contextMenu.campaign.name}"?`)) {
                deleteCampaign.mutate(contextMenu.campaign.id)
                setContextMenu(null)
              }
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <span><Trash2 size={13} /></span>
            Delete campaign
          </button>
        </div>
      )}
    </div>
  )
}
