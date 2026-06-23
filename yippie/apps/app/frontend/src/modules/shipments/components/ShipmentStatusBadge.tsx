export type ShipmentStatus =
  | 'registered'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned'
  | 'cancelled'

const STATUS_STYLES: Record<ShipmentStatus, { label: string; className: string }> = {
  registered:        { label: 'Registered',        className: 'bg-slate-100 text-slate-600' },
  in_transit:        { label: 'In transit',         className: 'bg-blue-50 text-blue-700' },
  out_for_delivery:  { label: 'Out for delivery',   className: 'bg-amber-50 text-amber-700' },
  delivered:         { label: 'Delivered',           className: 'bg-green-50 text-green-700' },
  exception:         { label: 'Exception',           className: 'bg-red-50 text-red-700' },
  returned:          { label: 'Returned',            className: 'bg-slate-100 text-slate-500' },
  cancelled:         { label: 'Cancelled',           className: 'bg-slate-100 text-slate-400' },
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const { label, className } = STATUS_STYLES[status] ?? STATUS_STYLES.registered
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  )
}
