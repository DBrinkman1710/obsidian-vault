import { useEffect, useRef, useState } from 'react'
import { Settings, GripVertical } from 'lucide-react'
import type { ContactColumnPref } from '../../../auth/useAuth'

// Name is always visible and non-toggleable; it is not part of the picker list.
export const DEFAULT_CONTACT_COLUMNS: ContactColumnPref[] = [
  { key: 'name', label: 'Name', visible: true, order: 0 },
  { key: 'email', label: 'Email', visible: true, order: 1 },
  { key: 'company', label: 'Company', visible: true, order: 2 },
  { key: 'phone', label: 'Phone', visible: true, order: 3 },
  { key: 'notes', label: 'Notes', visible: false, order: 4 },
  { key: 'created_at', label: 'Added', visible: false, order: 5 },
  { key: 'updated_at', label: 'Last updated', visible: false, order: 6 },
]

const LOCKED_KEYS = new Set(['name'])

/** Merge stored prefs with defaults so newly added columns always appear. */
export function resolveColumns(prefs?: ContactColumnPref[] | null): ContactColumnPref[] {
  if (!prefs || prefs.length === 0) return DEFAULT_CONTACT_COLUMNS.map(c => ({ ...c }))
  const byKey = new Map(prefs.map(p => [p.key, p]))
  const merged = DEFAULT_CONTACT_COLUMNS.map(def => {
    const stored = byKey.get(def.key)
    return stored ? { ...def, visible: stored.visible, order: stored.order } : { ...def }
  })
  return merged.sort((a, b) => a.order - b.order)
}

export function ColumnPicker({ value, onChange, saving }: {
  value: ContactColumnPref[]
  onChange: (next: ContactColumnPref[]) => void
  saving?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const cols = [...value].sort((a, b) => a.order - b.order)

  function toggle(key: string) {
    if (LOCKED_KEYS.has(key)) return
    onChange(cols.map(c => (c.key === key ? { ...c, visible: !c.visible } : c)))
  }

  function reorder(fromKey: string, toKey: string) {
    if (fromKey === toKey) return
    const order = cols.map(c => c.key)
    const from = order.indexOf(fromKey)
    const to = order.indexOf(toKey)
    if (from < 0 || to < 0) return
    order.splice(to, 0, order.splice(from, 1)[0])
    onChange(cols.map(c => ({ ...c, order: order.indexOf(c.key) })))
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} title="Customise columns"
        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
        <Settings size={16} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2">
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center justify-between">
            <span>Columns</span>
            {saving && <span className="text-slate-400 normal-case font-normal">Saving…</span>}
          </div>
          <ul className="flex flex-col">
            {cols.map(col => {
              const locked = LOCKED_KEYS.has(col.key)
              return (
                <li key={col.key}
                  draggable={!locked}
                  onDragStart={() => !locked && setDragKey(col.key)}
                  onDragOver={e => { if (dragKey) e.preventDefault() }}
                  onDrop={() => { if (dragKey) { reorder(dragKey, col.key); setDragKey(null) } }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${locked ? 'opacity-70' : 'hover:bg-slate-50 cursor-grab'}`}>
                  <GripVertical size={13} className={locked ? 'text-transparent' : 'text-slate-300'} />
                  <input type="checkbox" checked={col.visible} disabled={locked} onChange={() => toggle(col.key)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer" />
                  <span className="text-sm text-slate-700">{col.label}</span>
                  {locked && <span className="ml-auto text-[10px] text-slate-400 uppercase">always</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
