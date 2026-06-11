import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

export interface ContactLabel {
  id: string
  name: string
  color: string
}

export function fetchLabels() {
  return api.get<ContactLabel[]>('/contacts/labels').then(r => r.data)
}

export function LabelChip({ label, selected, onClick }: {
  label: ContactLabel
  selected?: boolean
  onClick?: () => void
}) {
  // Tinted style stays readable for any hue (no white-on-yellow).
  const style = {
    backgroundColor: label.color + (selected ? '33' : '1A'),
    color: label.color,
    borderColor: label.color + (selected ? '' : '4D'),
  }
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap'
  if (!onClick) return <span className={base} style={style}>{label.name}</span>
  return (
    <button type="button" onClick={onClick} className={`${base} transition-colors cursor-pointer`} style={style}>
      {label.name}
    </button>
  )
}

export function LabelPicker({ selectedIds, onChange }: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const { user } = useAuth()
  const { data: labels, isLoading } = useQuery({
    queryKey: ['contact-labels'],
    queryFn: fetchLabels,
  })

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  if (isLoading) return <p className="text-xs text-slate-400">Loading labels…</p>

  if (!labels || labels.length === 0) {
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
    return (
      <p className="text-xs text-slate-400">
        No labels yet.
        {isAdmin && (
          <> Create them in <Link to="/settings/labels" className="text-blue-600 hover:underline">Settings → Labels</Link>.</>
        )}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map(label => (
        <LabelChip
          key={label.id}
          label={label}
          selected={selectedIds.includes(label.id)}
          onClick={() => toggle(label.id)}
        />
      ))}
    </div>
  )
}
