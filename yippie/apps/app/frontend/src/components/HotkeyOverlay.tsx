import { useEffect, useState } from 'react'
import { Keyboard } from 'lucide-react'
import { CloseButton } from '../shell/CloseButton'
import { useAuth } from '../auth/useAuth'

// [UX-PSYCH] Keyboard shortcut discovery: pressing "?" anywhere in the app
// opens this overlay. The list below is an inventory of the keydown handlers
// that actually exist in the codebase — do not add shortcuts that aren't wired.
//   App.tsx            g→i (goto inbox)
//   useQuickCapture.ts ⌘K / Ctrl+K (Yip quick capture)
//   InboxQueue.tsx     c, Esc, j, k, r
//   DraftReview.tsx    r, e, ⌘/Ctrl+Enter
//   ComposeModal.tsx   ⌘/Ctrl+Enter

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl'

interface Shortcut { keys: string[]; label: string }
interface Group { title: string; shortcuts: Shortcut[] }

const GROUPS: Group[] = [
  {
    title: 'Anywhere',
    shortcuts: [
      { keys: ['g', 'i'], label: 'Go to Inbox' },
      { keys: [`${MOD} K`], label: 'Ask Yip (quick capture)' },
      { keys: ['?'], label: 'Show this overlay' },
    ],
  },
  {
    title: 'Inbox',
    shortcuts: [
      { keys: ['j'], label: 'Next message' },
      { keys: ['k'], label: 'Previous message' },
      { keys: ['r'], label: 'Open focused message' },
      { keys: ['c'], label: 'Compose new email' },
      { keys: ['Esc'], label: 'Close compose' },
    ],
  },
  {
    title: 'Message view',
    shortcuts: [
      { keys: ['r'], label: 'Focus the reply box' },
      { keys: ['e'], label: 'Approve draft' },
      { keys: [`${MOD} Enter`], label: 'Send reply' },
    ],
  },
  {
    title: 'Compose',
    shortcuts: [
      { keys: [`${MOD} Enter`], label: 'Send email' },
    ],
  },
]

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md"
      style={{ fontFamily: 'var(--font-mono)', boxShadow: '0 1px 0 rgba(15,23,42,0.06)' }}
    >
      {children}
    </kbd>
  )
}

export default function HotkeyOverlay() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const el = e.target as HTMLElement
      const tag = el.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') {
        e.preventDefault()
        setOpen(v => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4" onClick={() => setOpen(false)}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-pop-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Keyboard size={16} className="text-slate-400" />
            Keyboard shortcuts
          </h2>
          <CloseButton onClick={() => setOpen(false)} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {user?.hotkeys_enabled === false && (
            <div className="mb-4 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              Hotkeys are turned off in your profile settings — these shortcuts won't fire until you re-enable them.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
            {GROUPS.map(group => (
              <div key={group.title}>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">{group.title}</p>
                <div className="flex flex-col gap-1.5">
                  {group.shortcuts.map(s => (
                    <div key={group.title + s.label} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-600">{s.label}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {s.keys.map((k, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-[10px] text-slate-300">then</span>}
                            <Key>{k}</Key>
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 shrink-0 bg-slate-50">
          <p className="text-xs text-slate-400">
            Press <Key>?</Key> anywhere to open this overlay.
          </p>
        </div>
      </div>
    </div>
  )
}
