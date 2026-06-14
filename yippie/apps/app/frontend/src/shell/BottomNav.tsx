import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Inbox, Users, ClipboardList, Activity, CreditCard, Calendar,
  MessageSquare, Settings, Kanban,
  type LucideIcon,
} from 'lucide-react'
import { useTenantConfig } from '../App'
import { api } from '../api/client'

const MODULE_MAP: Record<string, { label: string; Icon: LucideIcon; path: string }> = {
  inbox:    { label: 'Inbox',    Icon: Inbox,         path: '/inbox' },
  contacts: { label: 'Contacts', Icon: Users,         path: '/contacts' },
  tickets:  { label: 'Tickets',  Icon: ClipboardList, path: '/tickets' },
  calendar: { label: 'Calendar', Icon: Calendar,      path: '/calendar' },
  pipeline: { label: 'Pipeline', Icon: Kanban,        path: '/pipeline' },
  activity: { label: 'Activity', Icon: Activity,      path: '/activity' },
  billing:  { label: 'Billing',  Icon: CreditCard,    path: '/billing' },
  chat:     { label: 'Chat',     Icon: MessageSquare, path: '/chat' },
}

export function BottomNav() {
  const config = useTenantConfig()

  const { data: draftCount } = useQuery({
    queryKey: ['drafts', 'count'],
    queryFn: () => api.get('/inbox/drafts/count').then(r => r.data),
    refetchInterval: 60_000,
    enabled: !!config,
  })

  const { data: deadlineData } = useQuery({
    queryKey: ['tickets', 'deadline-count'],
    queryFn: () => api.get('/tickets/deadline-count').then(r => r.data),
    refetchInterval: 60_000,
    enabled: !!config,
  })

  if (!config) return null

  const pendingCount: number = draftCount?.pending ?? 0
  const inboxBadge = pendingCount > 0 ? (pendingCount > 9 ? '9+' : String(pendingCount)) : null
  const redCount: number = deadlineData?.red ?? 0
  const ticketBadge = redCount > 0 ? (redCount > 9 ? '9+' : String(redCount)) : null

  const primaryColor = config.branding.primary_color

  const modules = config.enabled_modules
    .filter(mod => MODULE_MAP[mod])
    .slice(0, 4)

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex"
      style={primaryColor ? { borderColor: `${primaryColor}30` } : undefined}
    >
      {modules.map(mod => {
        const { label, Icon, path } = MODULE_MAP[mod]
        return (
          <NavLink
            key={mod}
            to={path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors ${
                isActive ? 'text-yippie' : 'text-slate-400'
              }`
            }
            style={({ isActive }) =>
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
            <span>{label}</span>
          </NavLink>
        )
      })}

      {/* Settings tab always last */}
      <NavLink
        to="/settings/profile"
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors ${
            isActive ? 'text-yippie' : 'text-slate-400'
          }`
        }
      >
        <Settings size={20} strokeWidth={1.8} />
        <span>Settings</span>
      </NavLink>
    </nav>
  )
}
