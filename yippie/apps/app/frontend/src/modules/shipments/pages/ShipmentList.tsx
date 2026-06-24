import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, Plus, RefreshCw, Settings } from 'lucide-react'
import { api } from '../../../api/client'
import { ShipmentStatusBadge, type ShipmentStatus } from '../components/ShipmentStatusBadge'
import { CarrierBadge, type Carrier } from '../components/CarrierBadge'
import { CreateShipmentModal } from '../components/CreateShipmentModal'
import { ShipmentSettingsModal } from '../components/ShipmentSettingsModal'
import { useIsViewOnly } from '../../../shell/ModuleGate'
import { useAuth } from '../../../auth/useAuth'

interface Shipment {
  id: string
  tracking_number: string
  carrier: Carrier
  status: ShipmentStatus
  contact_id: string | null
  order_reference: string | null
  estimated_delivery: string | null
  last_event_description: string | null
  last_event_at: string | null
  created_at: string
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'registered', label: 'Registered' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'out_for_delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'exception', label: 'Exception' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CARRIER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All carriers' },
  { value: 'sendcloud', label: 'Sendcloud' },
  { value: 'postnl', label: 'PostNL' },
  { value: 'dhl', label: 'DHL' },
  { value: 'dpd', label: 'DPD' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'other', label: 'Other' },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ShipmentList() {
  const navigate = useNavigate()
  const isViewOnly = useIsViewOnly()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [showCreate, setShowCreate] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCarrier, setFilterCarrier] = useState('')

  const params = new URLSearchParams()
  if (filterStatus) params.set('status', filterStatus)
  if (filterCarrier) params.set('carrier', filterCarrier)

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['shipments', filterStatus, filterCarrier],
    queryFn: () =>
      api.get(`/shipments?${params.toString()}`).then((r: any) => r.data as { items: Shipment[]; total: number }),
  })

  const shipments = data?.items ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Track & Trace</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.total ?? 0} shipment{data?.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Settings"
            >
              <Settings size={16} />
            </button>
          )}
          {!isViewOnly && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-3 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              <Plus size={15} />
              New shipment
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filterCarrier}
          onChange={e => setFilterCarrier(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
        >
          {CARRIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {shipments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package size={40} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No shipments yet</p>
          {!isViewOnly && (
            <p className="text-sm text-slate-400 mt-1">
              Click "New shipment" to start tracking a delivery.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Tracking #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Carrier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Order ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">ETA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Last event</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Added</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s: any) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/tracking/${s.id}`)}
                  className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors last:border-0"
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-800">{s.tracking_number}</span>
                  </td>
                  <td className="px-4 py-3">
                    <CarrierBadge carrier={s.carrier} />
                  </td>
                  <td className="px-4 py-3">
                    <ShipmentStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.order_reference ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(s.estimated_delivery)}
                  </td>
                  <td className="px-4 py-3 text-slate-500 max-w-[200px]">
                    <span className="truncate block">
                      {s.last_event_description ?? <span className="text-slate-300">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {formatDate(s.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateShipmentModal
          onClose={() => setShowCreate(false)}
          onCreated={id => navigate(`/tracking/${id}`)}
        />
      )}
      {showSettings && (
        <ShipmentSettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}
