import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

/* ── useSelection — shared list-selection state ─────────────────────── */
export function useSelection(ids: string[]) {
  const [sel, setSel] = useState<Set<string>>(() => new Set())

  // drop ids that are no longer in the list (after filter/search)
  useEffect(() => {
    setSel(prev => {
      const next = new Set([...prev].filter(id => ids.includes(id)))
      return next.size === prev.size ? prev : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')])

  function toggle(id: string, e?: React.SyntheticEvent) {
    e?.stopPropagation()
    setSel(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleAll() {
    setSel(prev =>
      prev.size === ids.length && ids.length > 0 ? new Set() : new Set(ids)
    )
  }

  function clear() { setSel(new Set()) }

  return {
    sel,
    toggle,
    toggleAll,
    clear,
    has: (id: string) => sel.has(id),
    count: sel.size,
    all: ids.length > 0 && sel.size === ids.length,
    some: sel.size > 0 && sel.size < ids.length,
  }
}

/* ── Checkbox — branded SVG so cascade can't flatten the checked state ─ */
interface CheckboxProps {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: React.SyntheticEvent) => void
  size?: number
  ariaLabel?: string
}

export function Checkbox({ checked, indeterminate = false, onChange, size = 18, ariaLabel }: CheckboxProps) {
  const on = checked || indeterminate
  const fill = on ? '#5ba4f5' : '#ffffff'
  const stroke = on ? '#5ba4f5' : '#cbd5e1'

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(e) }
  }

  return (
    <span
      role="checkbox"
      tabIndex={0}
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      onClick={e => { e.stopPropagation(); onChange(e) }}
      onKeyDown={handleKey}
      style={{ display: 'inline-flex', flexShrink: 0, cursor: 'pointer', lineHeight: 0, borderRadius: 5 }}
    >
      <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
        <rect x="0.9" y="0.9" width="16.2" height="16.2" rx="4.2" fill={fill} stroke={stroke} strokeWidth="1.5" />
        {indeterminate
          ? <rect x="4.5" y="8" width="9" height="2" rx="1" fill="#ffffff" />
          : checked
            ? <path d="M4.8 9.3 L7.6 12 L13.2 6.2" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            : null}
      </svg>
    </span>
  )
}

/* ── BulkBar — fixed floating bar at page bottom when count > 0 ─────── */
export interface BulkAction {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onClick: () => void
}

interface BulkBarProps {
  count: number
  onClear: () => void
  actions?: BulkAction[]
}

export function BulkBar({ count, onClear, actions = [] }: BulkBarProps) {
  if (!count) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl shadow-lg whitespace-nowrap">
      <span className="text-sm font-semibold text-blue-900 shrink-0">
        {count} selected
      </span>
      <div className="h-4 w-px bg-blue-200 shrink-0" />
      <div className="flex gap-4 flex-wrap">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${a.danger ? 'text-red-600 hover:text-red-800' : 'text-blue-700 hover:text-blue-900'}`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClear}
        aria-label="Clear selection"
        className="text-slate-400 hover:text-slate-600 ml-2 shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  )
}
