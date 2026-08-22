import { Monitor } from 'lucide-react'
import { useMobile } from './useMobile'
import { useT } from '../hooks/useT'

export function DesktopOnly({ children }: { children: React.ReactNode }) {
  const isMobile = useMobile()
  const t = useT()
  if (!isMobile) return <>{children}</>
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
        <Monitor size={28} className="text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700">{t('shell_desktop_only_title')}</h3>
      <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
        {t('shell_desktop_only_desc')}
      </p>
    </div>
  )
}
