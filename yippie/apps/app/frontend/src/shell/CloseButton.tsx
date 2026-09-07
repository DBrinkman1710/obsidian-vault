import { X } from 'lucide-react'
import { useT } from '../hooks/useT'

export function CloseButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('shell_close')}
      title={t('shell_close')}
      className={`text-slate-400 hover:text-slate-600 transition-colors ${className}`}
    >
      <X size={18} />
    </button>
  )
}
