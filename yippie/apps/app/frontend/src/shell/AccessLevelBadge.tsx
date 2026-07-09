import { Check, Eye, X } from 'lucide-react'
import type { AccessLevel } from '../hooks/useRbacPermissions'

interface Props {
  level: AccessLevel
  size?: 'sm' | 'md'
}

const CONFIG: Record<AccessLevel, { label: string; icon: React.ReactNode; cls: string }> = {
  full:       { label: 'Full',       icon: <Check size={10} />, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  view:       { label: 'View',       icon: <Eye size={10} />,   cls: 'text-orange-500 bg-orange-50  border-orange-200'  },
  restricted: { label: 'Restricted', icon: <X size={10} />,     cls: 'text-red-500    bg-red-50     border-red-200'     },
}

export function AccessLevelBadge({ level, size = 'sm' }: Props) {
  const { label, icon, cls } = CONFIG[level]
  const sz = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full border ${sz} ${cls}`}>
      {icon}{label}
    </span>
  )
}
