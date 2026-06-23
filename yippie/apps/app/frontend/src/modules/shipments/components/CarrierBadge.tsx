export type Carrier = 'sendcloud' | 'postnl' | 'dhl' | 'dpd' | 'ups' | 'fedex' | 'other'

const CARRIER_LABELS: Record<Carrier, string> = {
  sendcloud: 'Sendcloud',
  postnl:    'PostNL',
  dhl:       'DHL',
  dpd:       'DPD',
  ups:       'UPS',
  fedex:     'FedEx',
  other:     'Other',
}

export function CarrierBadge({ carrier }: { carrier: Carrier }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
      {CARRIER_LABELS[carrier] ?? carrier}
    </span>
  )
}
