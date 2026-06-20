import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Inbox, Users, ClipboardList, Activity, CreditCard, Calendar,
  MessageSquare, Settings, LogOut, Building2, ShieldCheck, UserCircle, Kanban,
  ChevronLeft, ChevronRight, Network,
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
  pipeline: { label: 'Kanban',    Icon: Kanban,        path: '/pipeline' },
  activity: { label: 'Activity',  Icon: Activity,      path: '/activity' },
  billing:  { label: 'Billing',   Icon: CreditCard,    path: '/billing' },
  chat:     { label: 'Live Chat', Icon: MessageSquare, path: '/chat' },
  departments: { label: 'Departments', Icon: Network,  path: '/settings/departments' },
}

const STORAGE_KEY = 'yippie:sidebarCollapsed'

export function Sidebar() {
  const config = useTenantConfig()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

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

  const { data: chatCountData } = useQuery({
    queryKey: ['chat-open-count'],
    queryFn: () => api.get('/chat/sessions/count').then(r => r.data),
    refetchInterval: 60_000,
    enabled: !!config && (config.enabled_modules ?? []).includes('chat'),
  })

  const { data: myDepts } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments', 'my'],
    queryFn: () => api.get('/departments/my').then(r => r.data),
    enabled: !!config && (config.enabled_modules ?? []).includes('departments'),
    staleTime: 60_000,
  })

  const pendingCount: number = draftCount?.pending ?? 0
  const badgeLabel = pendingCount === 0 ? null : pendingCount > 9 ? '9+' : String(pendingCount)
  const redCount: number = deadlineData?.red ?? 0
  const orangeCount: number = deadlineData?.orange ?? 0
  const redBadge = redCount === 0 ? null : redCount > 9 ? '9+' : String(redCount)
  const orangeBadge = orangeCount === 0 ? null : orangeCount > 9 ? '9+' : String(orangeCount)

  const toastShownRef = useRef(false)
  useEffect(() => {
    if (toastShownRef.current) return
    if (redCount > 0) {
      toastShownRef.current = true
      toast.warning(
        `${redCount} overdue ticket${redCount > 1 ? 's' : ''} need attention`,
        { duration: 8000, action: { label: 'View', onClick: () => navigate('/tickets') } }
      )
    }
  }, [redCount, navigate])
  const chatOpenCount: number = chatCountData?.open ?? 0
  const chatBadge = chatOpenCount === 0 ? null : chatOpenCount > 9 ? '9+' : String(chatOpenCount)

  const location = useLocation()
  const SETTINGS_OWN = ['/settings/profile', '/settings/team', '/settings/superadmins']
  const settingsActive =
    location.pathname === '/settings' ||
    (location.pathname.startsWith('/settings') &&
      !SETTINGS_OWN.some(p => location.pathname.startsWith(p)))

  if (!config) return null

  const primaryColor = config.branding.primary_color

  // Shared nav-link class builder
  function navCls(isActive: boolean) {
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
      isActive
        ? 'bg-white/20 text-white font-semibold'
        : 'text-white/75 hover:bg-white/10 hover:text-white'
    }`
  }

  return (
    <aside
      className={`hidden md:flex md:flex-col h-screen bg-yippie text-white shrink-0 overflow-y-auto transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
      style={primaryColor ? { backgroundColor: primaryColor } : undefined}
    >

      {/* Logo + tenant */}
      <div className={`pt-6 pb-5 ${collapsed ? 'px-3' : 'px-5'}`}>
        <div className="flex items-center mb-1">
          <img src="/logo-blue-bg-mark.svg" alt="Yippie" className={collapsed ? 'h-8 w-8 shrink-0' : 'h-10 w-10 shrink-0'} />
        </div>
        {!collapsed && config.branding.logo_url && (
          <div className="mt-2 mb-1">
            <img
              src={config.branding.logo_url}
              alt={config.tenant_name}
              className="h-6 object-contain max-w-[120px]"
            />
          </div>
        )}
        {!collapsed && (
          <p className="text-white/60 text-xs font-medium pl-0.5 truncate">{config.tenant_name}</p>
        )}
      </div>

      {/* Nav — ordered by config.enabled_modules (set by superadmin) */}
      <nav className="flex-1 px-2 space-y-0.5">
        {config.enabled_modules
          .filter(mod => MODULE_MAP[mod])
          .map(mod => {
            const { label, Icon, path } = MODULE_MAP[mod]
            return (
              <div key={mod}>
              <NavLink
                to={path}
                title={collapsed ? label : undefined}
                className={({ isActive }) => navCls(isActive)}
              >
                <Icon size={16} strokeWidth={2} className="shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && mod === 'inbox' && (
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

                {!collapsed && mod === 'chat' && chatBadge && (
                  <span className="bg-green-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                    {chatBadge}
                  </span>
                )}
                {!collapsed && mod === 'tickets' && (redBadge || orangeBadge) && (
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

              {mod === 'inbox' && !collapsed && myDepts && myDepts.length > 0 && (
                <div className="pl-5 mt-0.5 space-y-0.5">
                  {myDepts.map(dept => {
                    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
                    const isThisDept = params.get('dept') === dept.id
                    return (
                      <NavLink
                        key={dept.id}
                        to={`/inbox?dept=${dept.id}`}
                        className={() => `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                          isThisDept ? 'bg-white/20 text-white font-semibold' : 'text-white/65 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Network size={12} strokeWidth={2} className="shrink-0" />
                        <span className="truncate">{dept.name}</span>
                      </NavLink>
                    )
                  })}
                </div>
              )}
              </div>
            )
          })
        }
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/15 px-2 py-3 space-y-0.5">
        {user?.role === 'superadmin' && (
          <NavLink
            to="/superadmin/clients"
            title={collapsed ? 'Clients' : undefined}
            className={({ isActive }) => navCls(isActive)}
          >
            <Building2 size={16} strokeWidth={2} />
            {!collapsed && <span>Clients</span>}
          </NavLink>
        )}

        <NavLink
          to="/settings/profile"
          title={collapsed ? 'Profile' : undefined}
          className={({ isActive }) => navCls(isActive)}
        >
          <UserCircle size={16} strokeWidth={2} />
          {!collapsed && <span>Profile</span>}
        </NavLink>

        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <>
            <NavLink
              to="/settings/team"
              title={collapsed ? 'Team' : undefined}
              className={({ isActive }) => navCls(isActive)}
            >
              <Users size={16} strokeWidth={2} />
              {!collapsed && <span>Team</span>}
            </NavLink>
            <NavLink
              to="/settings"
              title={collapsed ? 'Settings' : undefined}
              className={() => navCls(settingsActive)}
            >
              <Settings size={16} strokeWidth={2} />
              {!collapsed && <span>Settings</span>}
            </NavLink>
          </>
        )}

        {user?.role === 'superadmin' && (
          <NavLink
            to="/settings/superadmins"
            title={collapsed ? 'Superadmins' : undefined}
            className={({ isActive }) => navCls(isActive)}
          >
            <ShieldCheck size={16} strokeWidth={2} />
            {!collapsed && <span>Superadmins</span>}
          </NavLink>
        )}

        {!collapsed && (
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
        )}

        {collapsed && (
          <button
            onClick={logout}
            title="Sign out"
            className="flex items-center justify-center w-full py-2.5 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut size={14} strokeWidth={2} />
          </button>
        )}

        {/* Collapse toggle */}
        <div className="flex justify-end pt-1">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>
    </aside>
  )
}
