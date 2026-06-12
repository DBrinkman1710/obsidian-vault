import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Inbox, Users, ClipboardList, Activity, CreditCard, Calendar,
  MessageSquare, Settings, LogOut, Building2, ShieldCheck, UserCircle,
  type LucideIcon,
} from 'lucide-react'
import { useTenantConfig } from '../App'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'

const MODULE_MAP: Record<string, { label: string; Icon: LucideIcon; path: string }> = {
  inbox:    { label: 'Inbox',     Icon: Inbox,         path: '/inbox' },
  contacts: { label: 'Contacts',  Icon: Users,         path: '/contacts' },
  tickets:  { label: 'Tickets',   Icon: ClipboardList, path: '/tickets' },
  calendar: { label: 'Calendar',  Icon: Calendar,      path: '/calendar' },
  activity: { label: 'Activity',  Icon: Activity,      path: '/activity' },
  billing:  { label: 'Billing',   Icon: CreditCard,    path: '/billing' },
  chat:     { label: 'Live Chat', Icon: MessageSquare, path: '/chat' },
}

export function Sidebar() {
  const config = useTenantConfig()
  const { user, logout } = useAuth()

  const { data: draftCount, isFetching: inboxFetching } = useQuery({
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

  const pendingCount: number = draftCount?.pending ?? 0
  const badgeLabel = pendingCount === 0 ? null : pendingCount > 9 ? '9+' : String(pendingCount)
  const redCount: number = deadlineData?.red ?? 0
  const orangeCount: number = deadlineData?.orange ?? 0
  const redBadge = redCount === 0 ? null : redCount > 9 ? '9+' : String(redCount)
  const orangeBadge = orangeCount === 0 ? null : orangeCount > 9 ? '9+' : String(orangeCount)

  if (!config) return null

  return (
    <aside className="flex flex-col w-56 h-screen bg-yippie text-white shrink-0 overflow-y-auto">

      {/* Logo + tenant */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2 mb-1">
          <svg viewBox="0 0 36 36" className="w-7 h-7 shrink-0" fill="white">
            <circle cx="10" cy="8" r="4" />
            <path d="M4 28 Q10 36 18 30" strokeWidth="3.5" stroke="white" fill="none" strokeLinecap="round"/>
            <circle cx="21" cy="5" r="2.5" />
          </svg>
          <span className="text-white font-bold text-xl tracking-tight">yippie</span>
        </div>
        {config.branding.logo_url && (
          <div className="mt-2 mb-1">
            <img
              src={config.branding.logo_url}
              alt={config.tenant_name}
              className="h-6 object-contain max-w-[120px]"
            />
          </div>
        )}
        <p className="text-white/60 text-xs font-medium pl-0.5 truncate">{config.tenant_name}</p>
      </div>

      {/* Nav — ordered by config.enabled_modules (set by superadmin) */}
      <nav className="flex-1 px-3 space-y-0.5">
        {config.enabled_modules
          .filter(mod => MODULE_MAP[mod])
          .map(mod => {
            const { label, Icon, path } = MODULE_MAP[mod]
            return (
              <NavLink
                key={mod}
                to={path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white font-semibold'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {mod === 'inbox' && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        inboxFetching ? 'bg-green-500' : 'bg-slate-400'
                      }`}
                      title={inboxFetching ? 'Refreshing…' : 'Idle'}
                    />
                    {badgeLabel && (
                      <span className="bg-white text-yippie text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                        {badgeLabel}
                      </span>
                    )}
                  </div>
                )}
                {mod === 'tickets' && (redBadge || orangeBadge) && (
                  <div className="flex items-center gap-1">
                    {redBadge && (
                      <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                        {redBadge}
                      </span>
                    )}
                    {orangeBadge && (
                      <span className="bg-orange-400 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                        {orangeBadge}
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            )
          })
        }
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/15 px-3 py-3 space-y-0.5">
        {user?.role === 'superadmin' && ['dev', 'devsandbox'].includes(config?.environment ?? '') && (
          <NavLink
            to="/superadmin/clients"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Building2 size={16} strokeWidth={2} />
            <span>Clients</span>
          </NavLink>
        )}

        <NavLink
          to="/settings/profile"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
            }`
          }
        >
          <UserCircle size={16} strokeWidth={2} />
          <span>Profile</span>
        </NavLink>

        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <>
            <NavLink
              to="/settings/team"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Users size={16} strokeWidth={2} />
              <span>Team</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Settings size={16} strokeWidth={2} />
              <span>Settings</span>
            </NavLink>
          </>
        )}

        {user?.role === 'superadmin' && (
          <NavLink
            to="/settings/superadmins"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-white/20 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <ShieldCheck size={16} strokeWidth={2} />
            <span>Superadmins</span>
          </NavLink>
        )}

        <div className="px-3 pt-2 pb-1">
          <p className="text-white/50 text-[11px] truncate mb-2">{user?.email}</p>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full text-white/70 hover:text-white text-sm font-medium transition-colors cursor-pointer"
          >
            <LogOut size={14} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
