import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Kanban, CalendarClock, ChevronDown, ChevronUp, Package } from 'lucide-react'
import { useMobile } from '../../../shell/useMobile'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { LabelChip, LabelPicker, type ContactLabel } from '../components/LabelChip'
import { CompanyBadge, type CompanyRef } from '../components/CompanyBadge'
import { CompanyPicker } from '../components/CompanyPicker'
import { useTenantConfig } from '../../../App'
import SendBookingModal from '../../booking/components/SendBookingModal'

function formatEventType(s: string): string {
  return s.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function payloadSummary(payload: any): string | null {
  if (!payload || typeof payload !== 'object') return null
  if (payload.subject) return payload.subject
  if (payload.comment) return String(payload.comment).slice(0, 80)
  if (payload.from_status && payload.to_status) return `${payload.from_status} → ${payload.to_status}`
  if (payload.status) return `Status: ${payload.status}`
  return null
}

function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function isLocalDutchFormat(phone: string | null | undefined): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 && digits.startsWith('0')
}

interface PipelineStage { id: string; name: string; color: string; contact_count?: number }

function PipelineStageBlock({ contactId }: { contactId: string }) {
  const qc = useQueryClient()
  const config = useTenantConfig()
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')

  const isPipelineEnabled = config?.enabled_modules?.includes('pipeline') ?? false

  const { data: stage } = useQuery<PipelineStage | null>({
    queryKey: ['contact-pipeline-stage', contactId],
    queryFn: () => api.get(`/pipeline/contacts/${contactId}/stage`).then((r: any) => r.data),
    enabled: isPipelineEnabled,
  })

  const { data: allStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
    enabled: isPipelineEnabled && editing,
  })

  const moveMut = useMutation({
    mutationFn: (stageId: string) => api.put(`/pipeline/contacts/${contactId}/stage`, { stage_id: stageId }),
    onMutate: async (stageId: any) => {
      await qc.cancelQueries({ queryKey: ['contact-pipeline-stage', contactId] })
      const prev = qc.getQueryData(['contact-pipeline-stage', contactId])
      const target = allStages.find((s: any) => s.id === stageId)
      if (target) qc.setQueryData(['contact-pipeline-stage', contactId], target)
      return { prev }
    },
    onError: (_err: any, _stageId: any, ctx: any) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['contact-pipeline-stage', contactId], ctx.prev)
      toast.error('Failed to update stage.')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-pipeline-stage', contactId] })
      qc.invalidateQueries({ queryKey: ['pipeline-board'] })
      setEditing(false)
    },
  })

  const removeMut = useMutation({
    mutationFn: () => api.delete(`/pipeline/contacts/${contactId}/stage`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-pipeline-stage', contactId] })
      qc.invalidateQueries({ queryKey: ['pipeline-board'] })
    },
  })

  if (!isPipelineEnabled) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Kanban size={12} className="text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">Kanban stage</h3>
        {stage && !editing && (
          <button
            onClick={() => { setSelectedId(stage.id); setEditing(true) }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={9} />
            Change
          </button>
        )}
      </div>
      <div className="px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            <select
              autoFocus
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Select stage…</option>
              {allStages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => { if (selectedId) moveMut.mutate(selectedId) }}
                disabled={!selectedId || moveMut.isPending}
                className="flex-1 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-opacity"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : stage ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: stage.color }} />
            <span className="text-sm font-semibold text-slate-700">{stage.name}</span>
            <button
              onClick={() => { if (confirm('Remove from kanban?')) removeMut.mutate() }}
              className="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setSelectedId(''); setEditing(true) }}
            className="text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            + Add to kanban
          </button>
        )}
      </div>
    </div>
  )
}

const SHIPMENT_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  registered:        { bg: 'bg-slate-100',   text: 'text-slate-600',  label: 'Registered' },
  in_transit:        { bg: 'bg-blue-100',    text: 'text-blue-700',   label: 'In transit' },
  out_for_delivery:  { bg: 'bg-amber-100',   text: 'text-amber-700',  label: 'Out for delivery' },
  delivered:         { bg: 'bg-emerald-100', text: 'text-emerald-700',label: 'Delivered' },
  exception:         { bg: 'bg-red-100',     text: 'text-red-700',    label: 'Exception' },
  returned:          { bg: 'bg-orange-100',  text: 'text-orange-700', label: 'Returned' },
  cancelled:         { bg: 'bg-slate-100',   text: 'text-slate-500',  label: 'Cancelled' },
}

function ShipmentsBlock({ contactId }: { contactId: string }) {
  const config = useTenantConfig()
  const isEnabled = config?.enabled_modules?.includes('tracking') ?? false

  const { data } = useQuery({
    queryKey: ['contact-shipments', contactId],
    queryFn: () => api.get('/shipments', { params: { contact_id: contactId, limit: 5 } }).then((r: any) => r.data),
    enabled: isEnabled,
  })

  if (!isEnabled) return null

  const items: any[] = data?.items ?? []

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Package size={12} className="text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">Orders</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 px-4 py-4">No orders found.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((s: any) => {
            const style = SHIPMENT_STATUS_STYLES[s.status] ?? { bg: 'bg-slate-100', text: 'text-slate-500', label: s.status }
            return (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {s.order_reference ?? s.tracking_number ?? '—'}
                  </p>
                  {s.tracking_number && s.order_reference && (
                    <p className="text-[10px] text-slate-400 truncate">{s.tracking_number}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const config = useTenantConfig()
  const bookingEnabled = config?.enabled_modules?.includes('booking') ?? false
  const marketingEnabled = config?.enabled_modules?.includes('marketing') ?? false
  const [bookingOpen, setBookingOpen] = useState(false)
  const [activityExpanded, setActivityExpanded] = useState(false)
  const isMobile = useMobile()
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [shipmentsOpen, setShipmentsOpen] = useState(false)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then((r: any) => r.data),
  })

  const { data: activity } = useQuery({
    queryKey: ['contact-activity', id],
    queryFn: () => api.get(`/activity`, { params: { contact_id: id } }).then((r: any) => r.data),
  })

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!contact) return <p className="text-sm text-red-500">Contact not found</p>

  const newTicketUrl = `/tickets/new?contact_id=${id}&contact_name=${encodeURIComponent(contact.full_name)}`
  const allActivity: any[] = activity ?? []
  const visibleActivity = activityExpanded ? allActivity : allActivity.slice(0, 3)
  const hiddenCount = allActivity.length - 3

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start">
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">{contact.full_name}</h1>
            {marketingEnabled && typeof contact.engagement_score === 'number' && (
              <span
                title="Engagement score"
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  contact.engagement_score >= 60
                    ? 'bg-emerald-50 text-emerald-700'
                    : contact.engagement_score >= 30
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {contact.engagement_score}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {bookingEnabled && (
              <button
                onClick={() => setBookingOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <CalendarClock size={12} />
                Send booking link
              </button>
            )}
            <Link
              to={newTicketUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              <Plus size={14} strokeWidth={2.5} />
              New Ticket
            </Link>
          </div>
        </div>

        {bookingEnabled && (
          <SendBookingModal
            contacts={[{ id: id!, full_name: contact.full_name }]}
            open={bookingOpen}
            onClose={() => setBookingOpen(false)}
          />
        )}

        {contact.notes && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}

        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Activity</h3>
        <div className="flex flex-col gap-2">
          {visibleActivity.map((ev: any) => {
            const summary = payloadSummary(ev.payload)
            return (
              <div key={ev.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-700">{formatEventType(ev.event_type)}</p>
                  <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">{timeAgo(ev.created_at)}</span>
                </div>
                {summary && <p className="text-xs text-slate-500 mt-1 italic">{summary}</p>}
              </div>
            )
          })}
          {allActivity.length === 0 && <p className="text-sm text-slate-400">No activity yet.</p>}
          {hiddenCount > 0 && (
            <button
              onClick={() => setActivityExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors py-1"
            >
              {activityExpanded ? (
                <><ChevronUp size={13} />Show less</>
              ) : (
                <><ChevronDown size={13} />Show {hiddenCount} more</>
              )}
            </button>
          )}
        </div>
      </div>

      <aside className="w-full md:w-96 md:flex-shrink-0">
        {isMobile ? (
          <div className="flex flex-col gap-3">
            {/* Details accordion */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setDetailsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-900"
              >
                Details
                {detailsOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {detailsOpen && (
                <>
                  <div className="px-4 pb-3 flex items-start gap-3 border-t border-slate-100 pt-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                      {initials(contact.full_name)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-bold text-slate-900 truncate">{contact.full_name}</p>
                      {contact.company && <p className="text-xs text-slate-500 truncate">{contact.company.name}</p>}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    <EmailRow contactId={id!} email={contact.email ?? null} />
                    <PhoneRow contactId={id!} phone={contact.phone ?? null} />
                    <CompanyRow contactId={id!} company={contact.company ?? null} />
                    <LabelsRow contactId={id!} labels={contact.labels ?? []} />
                  </div>
                </>
              )}
            </div>

            {/* Pipeline accordion */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setPipelineOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-900"
              >
                Pipeline stage
                {pipelineOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {pipelineOpen && (
                <div className="border-t border-slate-100">
                  <PipelineStageBlock contactId={id!} />
                </div>
              )}
            </div>

            {/* Shipments accordion */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button
                onClick={() => setShipmentsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-900"
              >
                Shipments
                {shipmentsOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </button>
              {shipmentsOpen && (
                <div className="border-t border-slate-100">
                  <ShipmentsBlock contactId={id!} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Details</h2>
              <p className="text-sm text-slate-500">Contact info &amp; properties.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                  {initials(contact.full_name)}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-bold text-slate-900 truncate">{contact.full_name}</p>
                  {contact.company && <p className="text-xs text-slate-500 truncate">{contact.company.name}</p>}
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                <EmailRow contactId={id!} email={contact.email ?? null} />
                <PhoneRow contactId={id!} phone={contact.phone ?? null} />
                <CompanyRow contactId={id!} company={contact.company ?? null} />
                <LabelsRow contactId={id!} labels={contact.labels ?? []} />
              </div>
            </div>

            <PipelineStageBlock contactId={id!} />
            <ShipmentsBlock contactId={id!} />
          </>
        )}
      </aside>
    </div>
  )
}

function EmailRow({ contactId, email }: { contactId: string; email: string | null }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${contactId}`, { email: value || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditing(false)
    },
    onError: () => toast.error('Failed to update email.'),
  })

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Email</p>
        {!editing && (
          <button
            type="button"
            onClick={() => { setValue(email ?? ''); setEditing(true) }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={9} />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            type="email"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="email@example.com"
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {saveMutation.isError && <p className="text-xs text-red-500">Something went wrong — try again.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center px-3 py-1 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-opacity disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-700">{email || '—'}</p>
      )}
    </div>
  )
}

function PhoneRow({ contactId, phone }: { contactId: string; phone: string | null }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${contactId}`, { phone: value || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditing(false)
    },
    onError: () => toast.error('Failed to update phone.'),
  })

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Phone</p>
        {!editing && (
          <button
            type="button"
            onClick={() => { setValue(phone ?? ''); setEditing(true) }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={9} />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            type="tel"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="+31 6 12345678"
            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {saveMutation.isError && <p className="text-xs text-red-500">Something went wrong — try again.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center px-3 py-1 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-opacity disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-slate-700">{phone || '—'}</p>
          {isLocalDutchFormat(phone) && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
              Local format
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function CompanyRow({ contactId, company }: { contactId: string; company: CompanyRef | null }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${contactId}`, { company_id: selectedId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['companies'] })
      setEditing(false)
    },
  })

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Company</p>
        {!editing && (
          <button
            type="button"
            onClick={() => { setSelectedId(company?.id ?? null); setEditing(true) }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={9} />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <CompanyPicker value={selectedId} onChange={setSelectedId} />
          {saveMutation.isError && <p className="text-xs text-red-500">Something went wrong — try again.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center px-3 py-1 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-opacity disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : company ? (
        <CompanyBadge name={company.name} />
      ) : (
        <p className="text-xs text-slate-400">No company.</p>
      )}
    </div>
  )
}

function LabelsRow({ contactId, labels }: { contactId: string; labels: ContactLabel[] }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${contactId}`, { label_ids: selectedIds }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['contact', contactId] })
      const prev = qc.getQueryData(['contact', contactId])
      const allLabels = qc.getQueryData<ContactLabel[]>(['contact-labels']) ?? []
      const nextLabels = selectedIds
        .map(lid => allLabels.find((l: any) => l.id === lid))
        .filter((l): l is ContactLabel => !!l)
      qc.setQueryData(['contact', contactId], (old: any) => old ? { ...old, labels: nextLabels } : old)
      return { prev }
    },
    onError: (_err: any, _vars: void, ctx: any) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['contact', contactId], ctx.prev)
      toast.error('Failed to update label.')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', contactId] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setEditing(false)
    },
  })

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Labels</p>
        {!editing && (
          <button
            type="button"
            onClick={() => { setSelectedIds(labels.map(l => l.id)); setEditing(true) }}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={9} />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <LabelPicker selectedIds={selectedIds} onChange={setSelectedIds} />
          {saveMutation.isError && <p className="text-xs text-red-500">Something went wrong — try again.</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center px-3 py-1 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-opacity disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : labels.length === 0 ? (
        <p className="text-xs text-slate-400">No labels.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map(label => <LabelChip key={label.id} label={label} />)}
        </div>
      )}
    </div>
  )
}
