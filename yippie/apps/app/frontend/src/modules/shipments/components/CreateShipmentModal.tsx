import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CloseButton } from '../../../shell/CloseButton'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import type { Carrier } from './CarrierBadge'
import { useT } from '../../../hooks/useT'

interface Props {
  onClose: () => void
  onCreated?: (id: string) => void
}

const CARRIERS: { value: Carrier; label: string }[] = [
  { value: 'sendcloud', label: 'Sendcloud' },
  { value: 'postnl',   label: 'PostNL' },
  { value: 'dhl',      label: 'DHL' },
  { value: 'dpd',      label: 'DPD' },
  { value: 'ups',      label: 'UPS' },
  { value: 'fedex',    label: 'FedEx' },
  { value: 'other',    label: 'other' }, // label resolved at render via t()
]

export function CreateShipmentModal({ onClose, onCreated }: Props) {
  const t = useT()
  const qc = useQueryClient()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [carrier, setCarrier] = useState<Carrier>('other')
  const [orderReference, setOrderReference] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/shipments', {
        tracking_number: trackingNumber.trim(),
        carrier,
        order_reference: orderReference.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: (res: any) => {
      toast.success(t('ship_added_toast'))
      qc.invalidateQueries({ queryKey: ['shipments'] })
      onCreated?.(res.data.id)
      onClose()
    },
    onError: () => toast.error(t('ship_add_error_toast')),
  })

  const carrierLabel = (value: Carrier) =>
    value === 'other' ? t('ship_carrier_other') : CARRIERS.find(c => c.value === value)?.label ?? value

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-slate-900">{t('ship_create_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              {t('ship_tracking_number_label')} <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              value={trackingNumber}
              onChange={e => setTrackingNumber(e.target.value)}
              placeholder={t('ship_tracking_number_ph')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('ship_carrier_label')}</label>
            <select
              value={carrier}
              onChange={e => setCarrier(e.target.value as Carrier)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie bg-white"
            >
              {CARRIERS.map(c => (
                <option key={c.value} value={c.value}>{carrierLabel(c.value)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              {t('ship_order_ref_label')}
            </label>
            <input
              value={orderReference}
              onChange={e => setOrderReference(e.target.value)}
              placeholder={t('ship_order_ref_ph')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('ship_notes_label')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t('ship_notes_ph')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t('ship_cancel')}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!trackingNumber.trim() || mutation.isPending}
            className="px-4 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
          >
            {mutation.isPending ? t('ship_adding') : t('ship_add_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}
