import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Clock, Pencil, Kanban, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { LabelChip, LabelPicker, type ContactLabel } from '../components/LabelChip'
import { CompanyBadge, type CompanyRef } from '../components/CompanyBadge'
import { CompanyPicker } from '../components/CompanyPicker'
import { useTenantConfig } from '../../../App'
import SendBookingModal from '../../booking/SendBookingModal'

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

interface PipelineStage { id: string; name: string; color: string; contact_count?: number }

function PipelineStageBlock({ contactId }: { contactId: string }) {
  const qc = useQueryClient()
  const config = useTenantConfig()
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')

  const isPipelineEnabled = config?.enabled_modules?.includes('pipeline') ?? false

  const { data: stage } = useQuery<PipelineStage | null>({
    queryKey: ['contact-pipeline-stage', contactId],
    queryFn: () => api.get(`/pipeline/contacts/${contactId}/stage`).then(r => r.data),
    enabled: isPipelineEnabled,
  })

  const { data: allStages = [] } = useQuery<PipelineStage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then(r => r.data),
    enabled: isPipelineEnabled && editing,
  })

  const moveMut = useMutation({
    mutationFn: (stageId: string) => api.put(`/pipeline/contacts/${contactId}/stage`, { stage_id: stageId }),
    onMutate: async (stageId) => {
      await qc.cancelQueries({ queryKey: ['contact-pipeline-stage', contactId] })
      const prev = qc.getQueryData(['contact-pipeline-stage', contactId])
      const target = allStages.find(s => s.id === stageId)
      if (target) qc.setQueryData(['contact-pipeline-stage', contactId], target)
      return { prev }
    },
    onError: (_err, _stageId, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(['contact-pipeline-stage', contactId], ctx.prev)
      toast.error('Failed to update stage.')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact-pipeline-stage', contactId] }); qc.invalidateQueries({ queryKey: ['pipeline-board'] }); setEditing(false) },
  })

  const removeMut = useMutation({
    mutationFn: () => api.delete(`/pipeline/contacts/${contactId}/stage`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contact-pipeline-stage', contactId] }); qc.invalidateQueries({ queryKey: ['pipeline-board'] }) },
  })

  if (!isPipelineEnabled) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Kanban size={12} className="text-slate-400" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Kanban</p>
        {stage && !editing && (
          <button
            onClick={() => { setSelectedId(stage.id); setEditing(true) }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={10} />
            Change
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <select
            autoFocus
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Select stage…</option>
            {allStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => { if (selectedId) moveMut.mutate(selectedId) }}
              disabled={!selectedId || moveMut.isPending}
              className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg transition-colors"
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
  )
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const config = useTenantConfig()
  const bookingEnabled = config?.enabled_modules?.includes('booking') ?? false
  const marketingEnabled = config?.enabled_modules?.includes('marketing') ?? false
  const [bookingOpen, setBookingOpen] = useState(false)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get(`/contacts/${id}`).then(r => r.data),
  })

  const { data: activity } = useQuery({
    queryKey: ['contact-activity', id],
    queryFn: () => api.get(`/activity`, { params: { contact_id: id } }).then(r => r.data),
  })

  const { data: recentMoments } = useQuery({
    queryKey: ['contact-moments', id],
    queryFn: () => api.get(`/activity`, { params: { contact_id: id, limit: 3 } }).then(r => r.data),
  })

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>
  if (!contact) return <p className="text-sm text-red-500">Contact not found</p>

  const newTicketUrl = `/tickets/new?contact_id=${id}&contact_name=${encodeURIComponent(contact.full_name)}`

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start">
      <div className="flex-1 min-w-0 max-w-2xl">
        <div className="flex items-start justify-between gap-2 mb-1">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <CalendarClock size={14} strokeWidth={2.5} />
                Send booking link
              </button>
            )}
            <Link
              to={newTicketUrl}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
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
        {contact.company && <p className="text-sm text-slate-500 mb-6">{contact.company.name}</p>}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Field label="Email" value={contact.email} />
          <PhoneField phone={contact.phone} />
        </div>

        <CompanyBlock contactId={id!} company={contact.company ?? null} />

        <LabelsBlock contactId={id!} labels={contact.labels ?? []} />

        {contact.notes && (
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-200">{contact.notes}</p>
          </div>
        )}

        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Activity</h3>
        <div className="flex flex-col gap-2">
          {activity?.map((ev: any) => (
            <div key={ev.id} className="border-l-2 border-slate-200 pl-4 py-1">
              <p className="text-xs text-slate-600">
                <span className="font-semibold">{ev.event_type}</span>
                <span className="text-slate-400 ml-2">· {new Date(ev.created_at).toLocaleString()}</span>
              </p>
            </div>
          ))}
          {(!activity || activity.length === 0) && (
            <p className="text-sm text-slate-400">No activity yet.</p>
          )}
        </div>
      </div>

      <div className="w-64 flex-shrink-0">
        <PipelineStageBlock contactId={id!} />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Moments</p>
        {!recentMoments || recentMoments.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentMoments.map((ev: any) => {
              const summary = payloadSummary(ev.payload)
              return (
                <div key={ev.id} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-900 leading-snug">{formatEventType(ev.event_type)}</span>
                    <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0 flex items-center gap-1">
                      <Clock size={10} />
                      {timeAgo(ev.created_at)}
                    </span>
                  </div>
                  <span className="inline-block text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {ev.module}
                  </span>
                  {summary && (
                    <p className="text-xs text-slate-500 mt-2 leading-snug italic">{summary}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CompanyBlock({ contactId, company }: { contactId: string; company: CompanyRef | null }) {
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
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</h3>
        {!editing && (
          <button
            type="button"
            onClick={() => { setSelectedId(company?.id ?? null); setEditing(true) }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={10} />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3 max-w-sm">
          <CompanyPicker value={selectedId} onChange={setSelectedId} />
          {saveMutation.isError && (
            <p className="text-sm text-red-500">Something went wrong — try again.</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
              {saveMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : company ? (
        <CompanyBadge name={company.name} />
      ) : (
        <p className="text-sm text-slate-400">No company.</p>
      )}
    </div>
  )
}

function LabelsBlock({ contactId, labels }: { contactId: string; labels: ContactLabel[] }) {
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
        .map(lid => allLabels.find(l => l.id === lid))
        .filter((l): l is ContactLabel => !!l)
      qc.setQueryData(['contact', contactId], (old: any) => old ? { ...old, labels: nextLabels } : old)
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
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
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Labels</h3>
        {!editing && (
          <button
            type="button"
            onClick={() => { setSelectedIds(labels.map(l => l.id)); setEditing(true) }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <Pencil size={10} />
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <LabelPicker selectedIds={selectedIds} onChange={setSelectedIds} />
          {saveMutation.isError && (
            <p className="text-sm text-red-500">Something went wrong — try again.</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
              {saveMutation.isPending && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin ml-1" />}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : labels.length === 0 ? (
        <p className="text-sm text-slate-400">No labels.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {labels.map(label => <LabelChip key={label.id} label={label} />)}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-900">{value || '—'}</p>
    </div>
  )
}

/** Returns true when the phone is a Dutch local format (0XXXXXXXXX, 10 digits starting with 0). */
function isLocalDutchFormat(phone: string | null | undefined): boolean {
  if (!phone) return false
  const digits = phone.replace(/\D/g, '')
  return digits.length === 10 && digits.startsWith('0')
}

function PhoneField({ phone }: { phone: string | null | undefined }) {
  const showWarning = isLocalDutchFormat(phone)
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Phone</p>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-sm text-slate-900">{phone || '—'}</p>
        {showWarning && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            Local format — may not match WhatsApp
          </span>
        )}
      </div>
    </div>
  )
}
