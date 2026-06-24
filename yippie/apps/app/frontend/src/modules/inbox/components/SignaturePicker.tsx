import { useState, useRef, useEffect } from 'react'
import { PenLine, ChevronDown } from 'lucide-react'
import { useSignatures, type Signature } from '../../../hooks/useSignatures'

/**
 * Compact dropdown to switch the signature appended to a compose/reply box.
 * Calls onPick with the chosen signature so the caller can swap the trailing
 * signature in its body/reply text. Hidden entirely when the user has none.
 */
export function SignaturePicker({ onPick }: { onPick: (sig: Signature) => void }) {
  const { data: signatures = [] } = useSignatures()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // No point showing a picker when there's nothing to pick from.
  if (signatures.length < 2) return null

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
        title="Insert signature"
      >
        <PenLine size={13} /> Signature <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg py-1 max-h-64 overflow-y-auto">
          {signatures.map((sig: any) => (
            <button
              key={sig.id}
              type="button"
              onClick={() => { onPick(sig); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-2"
            >
              <span className="truncate font-medium text-slate-700">{sig.name}</span>
              {sig.is_default && <span className="text-[10px] text-yippie font-semibold shrink-0">default</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
