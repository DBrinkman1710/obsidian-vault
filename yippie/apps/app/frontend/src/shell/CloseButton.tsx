import { X } from 'lucide-react'

export function CloseButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      title="Close"
      className={`text-slate-400 hover:text-slate-600 transition-colors ${className}`}
    >
      <X size={18} />
    </button>
  )
}
