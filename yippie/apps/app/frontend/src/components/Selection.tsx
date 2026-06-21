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
      onClick={onChange}
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

/* ── BulkBar — ink bar above list when count > 0 ────────────────────── */
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
    <div
      className="flex items-center gap-3 mb-3 px-4 py-2.5"
      style={{
        borderRadius: 'var(--radius-md)',
        background: 'var(--ink)',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <span className="font-mono text-[12.5px] font-semibold shrink-0 whitespace-nowrap">
        {count} selected
      </span>
      <span className="w-px h-[18px] shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }} />
      <div className="flex gap-1.5 flex-1 flex-wrap">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
            style={{
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,255,255,0.18)',
              background: a.danger ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.08)',
              fontFamily: 'var(--font-body)',
            }}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClear}
        aria-label="Clear selection"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-100 shrink-0"
        style={{
          color: 'rgba(255,255,255,0.7)',
          background: 'transparent',
          border: 'none',
          fontFamily: 'var(--font-body)',
          padding: '6px 8px',
        }}
      >
        <X size={14} />
        Clear
      </button>
    </div>
  )
}
