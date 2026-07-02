import { useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'

interface HelpTipProps {
  content: string
  title?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export function HelpTip({ content, title, placement = 'top' }: HelpTipProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)

  // Hidden when user has turned off tips
  if (user?.help_tips_enabled === false) return null

  const placementClasses: Record<string, string> = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Help"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-yippie/30"
      >
        <HelpCircle size={14} />
      </button>

      {open && (
        <>
          {/* Click-away overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div
            className={`absolute z-50 w-64 bg-white rounded-xl border border-slate-200 shadow-lg p-3.5 ${placementClasses[placement]}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              {title && (
                <p className="text-xs font-semibold text-slate-700">{title}</p>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto flex-shrink-0 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{content}</p>
          </div>
        </>
      )}
    </div>
  )
}
