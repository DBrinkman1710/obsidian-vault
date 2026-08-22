import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Inbox, Users, ClipboardList, Activity, CreditCard, Calendar,
  MessageSquare, Settings, Kanban, Package, Megaphone, TrendingUp, BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { useTenantConfig } from '../App'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'
import { useT } from '../hooks/useT'
import type { TKey } from '../i18n/translations'

const MODULE_MAP: Record<string, { labelKey: TKey; Icon: LucideIcon; path: string }> = {
  inbox:     { labelKey: 'inbox',     Icon: Inbox,         path: '/inbox' },
  contacts:  { labelKey: 'contacts',  Icon: Users,         path: '/contacts' },
  tickets:   { labelKey: 'tickets',   Icon: ClipboardList, path: '/tickets' },
  calendar:  { labelKey: 'calendar',  Icon: Calendar,      path: '/calendar' },
  pipeline:  { labelKey: 'kanban',    Icon: Kanban,        path: '/pipeline' },
  activity:  { labelKey: 'activity',  Icon: Activity,      path: '/activity' },
  billing:   { labelKey: 'billing',   Icon: CreditCard,    path: '/billing' },
  chat:      { labelKey: 'livechat',  Icon: MessageSquare, path: '/chat' },
  marketing: { labelKey: 'marketing', Icon: Megaphone,     path: '/marketing' },
  tracking:  { labelKey: 'tracking',  Icon: Package,       path: '/tracking' },
  sales:     { labelKey: 'sales',     Icon: TrendingUp,    path: '/sales' },
  saas:      { labelKey: 'saas',      Icon: BarChart3,     path: '/saas' },
}

function resolveOrder(savedOrder: string[] | null | undefined, enabledMods: string[]): string[] {
  const enabled = enabledMods.filter(m => MODULE_MAP[m])
  if (!savedOrder || savedOrder.length === 0) return enabled
  const saved = savedOrder.filter(m => MODULE_MAP[m] && enabled.includes(m))
  const newMods = enabled.filter(m => !saved.includes(m))
  return [...saved, ...newMods]
}

export function BottomNav() {
  const config = useTenantConfig()
  const { user } = useAuth()
  const t = useT()

  const { data: draftCount } = useQuery({
    queryKey: ['drafts', 'count'],
    queryFn: () => api.get('/inbox/drafts/count').then((r: any) => r.data),
    refetchInterval: 60_000,
    enabled: !!config,
  })

  const { data: deadlineData } = useQuery({
    queryKey: ['tickets', 'deadline-count'],
    queryFn: () => api.get('/tickets/deadline-count').then((r: any) => r.data),
    refetchInterval: 60_000,
    enabled: !!config,
  })

  if (!config) return null

  const pendingCount: number = draftCount?.pending ?? 0
  const inboxBadge = pendingCount > 0 ? (pendingCount > 9 ? '9+' : String(pendingCount)) : null
  const redCount: number = deadlineData?.red ?? 0
  const ticketBadge = redCount > 0 ? (redCount > 9 ? '9+' : String(redCount)) : null

  const primaryColor = config.branding.primary_color

  const orderedMods = resolveOrder(user?.sidebar_order, config.enabled_modules)
  const modules = orderedMods.slice(0, 4)

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex"
      style={primaryColor ? { borderColor: `${primaryColor}30` } : undefined}
    >
      {modules.map(mod => {
        const { labelKey, Icon, path } = MODULE_MAP[mod]
        return (
          <NavLink
            key={mod}
            to={path}
            className={({ isActive }: any) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-yippie' : 'text-slate-400'
              }`
            }
            style={({ isActive }: any) =>
              isActive && primaryColor ? { color: primaryColor } : undefined
            }
          >
            <div className="relative">
              <Icon size={20} strokeWidth={1.8} />
              {mod === 'inbox' && inboxBadge && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5">
                  {inboxBadge}
                </span>
              )}
              {mod === 'tickets' && ticketBadge && (
                <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5">
                  {ticketBadge}
                </span>
              )}
            </div>
            <span>{t(labelKey)}</span>
          </NavLink>
        )
      })}

      {/* Settings tab always last */}
      <NavLink
        to="/settings/profile"
        className={({ isActive }: any) =>
          `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors ${
            isActive ? 'text-yippie' : 'text-slate-400'
          }`
        }
      >
        <Settings size={20} strokeWidth={1.8} />
        <span>{t('shell_settings')}</span>
      </NavLink>
    </nav>
  )
}
