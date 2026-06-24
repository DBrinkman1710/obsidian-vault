import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

const PRESET_COLORS = ['#5BA4F5', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b']

export interface ContactLabel {
  id: string
  name: string
  color: string
}

export function fetchLabels() {
  return api.get<ContactLabel[]>('/contacts/labels').then((r: any) => r.data)
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
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])

  const { data: labels, isLoading } = useQuery({
    queryKey: ['contact-labels'],
    queryFn: fetchLabels,
  })

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      api.post<ContactLabel>('/contacts/labels', payload).then((r: any) => r.data),
    onSuccess: (label: any) => {
      qc.invalidateQueries({ queryKey: ['contact-labels'] })
      onChange([...selectedIds, label.id])
      setCreating(false)
      setNewName('')
      setNewColor(PRESET_COLORS[0])
    },
  })

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  if (isLoading) return <p className="text-xs text-slate-400">Loading labels…</p>

  return (
    <div className="space-y-2">
      {(!labels || labels.length === 0) && !creating && (
        <p className="text-xs text-slate-400">
          No labels yet.
          {isAdmin && (
            <> <Link to="/settings/labels" className="text-blue-600 hover:underline">Settings → Labels</Link> or create one below.</>
          )}
        </p>
      )}

      {labels && labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {labels.map((label: any) => (
            <LabelChip
              key={label.id}
              label={label}
              selected={selectedIds.includes(label.id)}
              onClick={() => toggle(label.id)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        creating ? (
          <div className="flex items-center gap-2 pt-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Label name"
              className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-yippie/30 focus:border-yippie"
              onKeyDown={e => {
                if (e.key === 'Enter' && newName.trim()) createMutation.mutate({ name: newName.trim(), color: newColor })
                if (e.key === 'Escape') { setCreating(false); setNewName('') }
              }}
            />
            <div className="flex gap-1 shrink-0">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-4 h-4 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    outline: newColor === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '1px',
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              disabled={!newName.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name: newName.trim(), color: newColor })}
              className="px-2 py-1 text-xs font-semibold bg-yippie text-white rounded-lg disabled:opacity-50 shrink-0"
            >
              {createMutation.isPending ? '…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setNewName('') }}
              className="text-xs text-slate-400 hover:text-slate-600 shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-xs font-semibold text-slate-400 hover:text-yippie transition-colors"
          >
            ＋ New label
          </button>
        )
      )}
    </div>
  )
}
