import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Clock, MapPin, Package, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useIsViewOnly } from '../../../shell/ModuleGate'
import { ShipmentStatusBadge, type ShipmentStatus } from '../components/ShipmentStatusBadge'
import { CarrierBadge, type Carrier } from '../components/CarrierBadge'
import { fmtDate, fmtDateTime } from '../../../lib/format'
import { useT } from '../../../hooks/useT'

interface ShipmentEvent {
  id: string
  event_at: string
  location: string | null
  status_code: string | null
  description: string
}

interface ShipmentDetail {
  id: string
  tracking_number: string
  carrier: Carrier
  status: ShipmentStatus
  contact_id: string | null
  order_reference: string | null
  notes: string | null
  estimated_delivery: string | null
  last_event_description: string | null
  last_event_at: string | null
  sendcloud_parcel_id: string | null
  created_at: string
  updated_at: string
  events: ShipmentEvent[]
}

const formatDate = fmtDate
const formatDateTime = fmtDateTime

export default function ShipmentDetail() {
  const t = useT()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isViewOnly = useIsViewOnly()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const [notes, setNotes] = useState<string>('')
  const [editingNotes, setEditingNotes] = useState(false)

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['shipments', id],
    queryFn: () => api.get(`/shipments/${id}`).then((r: any) => r.data as ShipmentDetail),
    enabled: !!id,
  })

  useEffect(() => {
    if (shipment && !editingNotes) setNotes(shipment.notes ?? '')
  }, [shipment?.id, shipment?.notes])

  const refreshMutation = useMutation({
    mutationFn: () => api.post(`/shipments/${id}/refresh`),
    onSuccess: () => {
      toast.success(t('ship_refreshed_toast'))
      qc.invalidateQueries({ queryKey: ['shipments', id] })
      qc.invalidateQueries({ queryKey: ['shipments'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(msg || 'Refresh failed')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/shipments/${id}`, payload),
    onSuccess: () => {
      toast.success(t('ship_notes_saved_toast'))
      qc.invalidateQueries({ queryKey: ['shipments', id] })
      setEditingNotes(false)
    },
    onError: () => toast.error(t('ship_notes_error_toast')),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.post(`/shipments/${id}/delete`),
    onSuccess: () => {
      toast.success(t('ship_deleted_toast'))
      navigate('/tracking')
    },
    onError: () => toast.error(t('ship_delete_error_toast')),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-yippie border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">{t('ship_not_found')}</p>
        <button onClick={() => navigate('/tracking')} className="mt-3 text-sm text-yippie hover:underline">
          {t('ship_back_to_list')}
        </button>
      </div>
    )
  }

  const events = [...shipment.events].reverse()

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/tracking')}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-900 font-mono">{shipment.tracking_number}</h1>
            <CarrierBadge carrier={shipment.carrier} />
            <ShipmentStatusBadge status={shipment.status} />
          </div>
          {shipment.order_reference && (
            <p className="text-sm text-slate-500 mt-0.5">{t('ship_detail_order_label')} {shipment.order_reference}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isViewOnly && (
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshMutation.isPending ? 'animate-spin' : ''} />
              {t('ship_refresh_btn')}
            </button>
          )}
          {!isViewOnly && isAdmin && (
            <button
              onClick={() => { if (window.confirm(t('ship_delete_confirm'))) deleteMutation.mutate() }}
              disabled={deleteMutation.isPending}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title={t('ship_delete_title')}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left — info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('ship_details_heading')}</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">{t('ship_detail_carrier')}</dt>
                <dd><CarrierBadge carrier={shipment.carrier} /></dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">{t('ship_detail_estimated_delivery')}</dt>
                <dd className="text-slate-700">{formatDate(shipment.estimated_delivery)}</dd>
              </div>
              {shipment.order_reference && (
                <div>
                  <dt className="text-slate-400 text-xs font-medium mb-0.5">{t('ship_detail_order_reference')}</dt>
                  <dd className="text-slate-700">{shipment.order_reference}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">{t('ship_detail_added')}</dt>
                <dd className="text-slate-500 text-xs">{formatDateTime(shipment.created_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-400 text-xs font-medium mb-0.5">{t('ship_detail_updated')}</dt>
                <dd className="text-slate-500 text-xs">{formatDateTime(shipment.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('ship_notes_heading')}</h3>
              {!isViewOnly && !editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-xs text-yippie hover:underline"
                >
                  {t('ship_notes_edit')}
                </button>
              )}
            </div>
            {editingNotes ? (
              <>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => updateMutation.mutate({ notes: notes || null })}
                    disabled={updateMutation.isPending}
                    className="px-3 py-1.5 text-xs font-semibold bg-yippie text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {updateMutation.isPending ? t('ship_notes_saving') : t('ship_notes_save')}
                  </button>
                  <button
                    onClick={() => { setEditingNotes(false); setNotes(shipment.notes ?? '') }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                  >
                    {t('ship_notes_cancel')}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                {shipment.notes || <span className="text-slate-300 italic">{t('ship_notes_empty')}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Right — tracking timeline */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
              {t('ship_history_heading')}
            </h3>

            {events.length === 0 ? (
              <div className="text-center py-10">
                <Package size={32} className="text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t('ship_history_empty')}</p>
                {!isViewOnly && (
                  <p className="text-xs text-slate-400 mt-1">
                    {t('ship_history_hint')}
                  </p>
                )}
              </div>
            ) : (
              <ol className="relative border-l border-slate-200 pl-6 space-y-5">
                {events.map((event, i) => (
                  <li key={event.id} className="relative">
                    <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 ${
                      i === 0
                        ? 'bg-yippie border-yippie'
                        : 'bg-white border-slate-300'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{event.description}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        {event.location && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <MapPin size={11} />
                            {event.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={11} />
                          {formatDateTime(event.event_at)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
