import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'

export interface ContextMenuItem {
  label?: string
  icon?: React.ReactNode
  onClick?: () => void
  danger?: boolean
  separator?: boolean
  header?: string
  shortcut?: string
  submenu?: ContextMenuItem[]
}

interface MenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

/* ── useContextMenu — open a themed menu at the cursor ──────────────── */
export function useContextMenu() {
  const [state, setState] = useState<MenuState | null>(null)

  function open(e: React.MouseEvent, items: ContextMenuItem[]) {
    e.preventDefault()
    e.stopPropagation()
    setState({ x: e.clientX, y: e.clientY, items })
  }

  function close() { setState(null) }

  return { state, open, close }
}

/* ── ContextMenu — themed right-click menu ───────────────────────────── */
interface ContextMenuProps {
  state: MenuState | null
  onClose: () => void
}

export function ContextMenu({ state, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const submenuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0, ready: false })
  const [hoverIdx, setHoverIdx] = useState(-1)
  const [submenuPos, setSubmenuPos] = useState({ x: 0, y: 0, ready: false })
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!state) {
      setPos(p => ({ ...p, ready: false }))
      setHoverIdx(-1)
      return
    }

    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onScroll() { onClose() }

    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [state, onClose])

  // clamp main menu to viewport after measuring
  useLayoutEffect(() => {
    if (!state || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const pad = 8
    const x = Math.min(state.x, window.innerWidth - r.width - pad)
    const y = Math.min(state.y, window.innerHeight - r.height - pad)
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y), ready: true })
  }, [state])

  // position submenu after measuring
  useLayoutEffect(() => {
    if (hoverIdx < 0 || !ref.current || !submenuRef.current) {
      setSubmenuPos(p => ({ ...p, ready: false }))
      return
    }
    const menuRect = ref.current.getBoundingClientRect()
    const subRect = submenuRef.current.getBoundingClientRect()
    const pad = 8
    // find the hovered item's button element
    const buttons = ref.current.querySelectorAll('[data-item-idx]')
    const btn = buttons[hoverIdx] as HTMLElement | undefined
    const itemTop = btn ? btn.getBoundingClientRect().top : menuRect.top

    let x = menuRect.right + 4
    if (x + subRect.width + pad > window.innerWidth) {
      x = menuRect.left - subRect.width - 4
    }
    let y = itemTop
    if (y + subRect.height + pad > window.innerHeight) {
      y = window.innerHeight - subRect.height - pad
    }
    setSubmenuPos({ x: Math.max(pad, x), y: Math.max(pad, y), ready: true })
  }, [hoverIdx, state])

  if (!state) return null

  const activeItem = hoverIdx >= 0 ? state.items[hoverIdx] : null
  const hasSubmenu = !!(activeItem?.submenu?.length)

  return (
    <div
      onClick={onClose}
      onContextMenu={e => { e.preventDefault(); onClose() }}
      className="fixed inset-0 z-[300]"
    >
      <div
        ref={ref}
        role="menu"
        onClick={e => e.stopPropagation()}
        className="fixed"
        style={{
          left: pos.x,
          top: pos.y,
          minWidth: 208,
          padding: 6,
          background: '#fff',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          fontFamily: 'var(--font-body)',
          opacity: pos.ready ? 1 : 0,
          transform: pos.ready ? 'scale(1)' : 'scale(0.97)',
          transformOrigin: 'top left',
          transition: 'opacity 90ms ease, transform 90ms ease',
        }}
      >
        {state.items.map((item, i) => {
          if (item.separator) {
            return (
              <div key={i} style={{ height: 1, background: 'var(--border-subtle)', margin: '6px 4px' }} />
            )
          }
          if (item.header) {
            return (
              <div
                key={i}
                style={{
                  padding: '7px 10px 4px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                {item.header}
              </div>
            )
          }

          const isHover = hoverIdx === i
          const isDanger = !!item.danger
          const hasSub = !!(item.submenu?.length)

          return (
            <button
              key={i}
              data-item-idx={i}
              role="menuitem"
              onMouseEnter={() => {
                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
                setHoverIdx(i)
              }}
              onMouseLeave={() => {
                if (!hasSub) {
                  hoverTimerRef.current = setTimeout(() => setHoverIdx(-1), 80)
                }
              }}
              onClick={() => {
                if (!hasSub) {
                  onClose()
                  item.onClick?.()
                }
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: hasSub ? 'default' : 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
                fontSize: 13.5,
                fontWeight: 500,
                lineHeight: 1,
                color: isDanger ? 'var(--status-urgent)' : 'var(--text-body)',
                background: isHover
                  ? isDanger ? 'var(--status-urgent-bg)' : 'var(--brand-soft)'
                  : 'transparent',
                transition: 'background 100ms ease',
              }}
            >
              {item.icon ? (
                <span
                  style={{
                    display: 'inline-flex',
                    color: isDanger
                      ? 'var(--status-urgent)'
                      : isHover ? 'var(--brand-deep)' : 'var(--text-subtle)',
                  }}
                >
                  {item.icon}
                </span>
              ) : (
                <span style={{ width: 15 }} />
              )}
              <span style={{ flex: 1 }}>{item.label}</span>
              {hasSub && (
                <ChevronRight
                  size={13}
                  style={{ color: isHover ? 'var(--brand-deep)' : 'var(--text-muted)' }}
                />
              )}
              {item.shortcut && !hasSub && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {item.shortcut}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Submenu flyout */}
      {hasSubmenu && (
        <div
          ref={submenuRef}
          role="menu"
          onClick={e => e.stopPropagation()}
          onMouseEnter={() => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
          }}
          onMouseLeave={() => {
            hoverTimerRef.current = setTimeout(() => setHoverIdx(-1), 80)
          }}
          className="fixed"
          style={{
            left: submenuPos.x,
            top: submenuPos.y,
            minWidth: 192,
            padding: 6,
            background: '#fff',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            fontFamily: 'var(--font-body)',
            opacity: submenuPos.ready ? 1 : 0,
            transform: submenuPos.ready ? 'scale(1)' : 'scale(0.97)',
            transformOrigin: 'top left',
            transition: 'opacity 80ms ease, transform 80ms ease',
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {activeItem!.submenu!.map((sub, j) => {
            const isDanger = !!sub.danger
            return (
              <button
                key={j}
                role="menuitem"
                onClick={() => { onClose(); sub.onClick?.() }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13.5,
                  fontWeight: 500,
                  lineHeight: 1,
                  color: isDanger ? 'var(--status-urgent)' : 'var(--text-body)',
                  background: 'transparent',
                  transition: 'background 100ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDanger ? 'var(--status-urgent-bg)' : 'var(--brand-soft)'
                  e.currentTarget.style.color = isDanger ? 'var(--status-urgent)' : 'var(--text-body)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {sub.icon ? (
                  <span style={{ display: 'inline-flex', color: 'var(--text-subtle)' }}>
                    {sub.icon}
                  </span>
                ) : (
                  <span style={{ width: 15 }} />
                )}
                <span style={{ flex: 1 }}>{sub.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
