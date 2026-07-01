import { useEffect, useRef, useState } from 'react'
import { useContextMenu, ContextMenu } from '../components/ContextMenu'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Inbox, Users, ClipboardList, Activity, CreditCard, Calendar,
  MessageSquare, LogOut, Building2, ShieldCheck, UserCircle, Kanban,
  ChevronLeft, ChevronRight, Megaphone, GripVertical, Package,
  TrendingUp, BarChart3, Settings, UsersRound,
  type LucideIcon,
} from 'lucide-react'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTenantConfig } from '../App'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'
import { useT } from '../hooks/useT'
import type { TKey } from '../i18n/translations'

const MODULE_MAP: Record<string, { labelKey: TKey; Icon: LucideIcon; path: string }> = {
  inbox:    { labelKey: 'inbox',    Icon: Inbox,         path: '/inbox' },
  contacts: { labelKey: 'contacts', Icon: Users,         path: '/contacts' },
  tickets:  { labelKey: 'tickets',  Icon: ClipboardList, path: '/tickets' },
  calendar: { labelKey: 'calendar', Icon: Calendar,      path: '/calendar' },
  pipeline: { labelKey: 'kanban',   Icon: Kanban,        path: '/pipeline' },
  activity: { labelKey: 'activity', Icon: Activity,      path: '/activity' },
  billing:  { labelKey: 'billing',  Icon: CreditCard,    path: '/billing' },
  chat:     { labelKey: 'livechat', Icon: MessageSquare, path: '/chat' },
  marketing: { labelKey: 'marketing', Icon: Megaphone,   path: '/marketing' },
  tracking:  { labelKey: 'tracking',  Icon: Package,     path: '/tracking' },
  sales:     { labelKey: 'sales',     Icon: TrendingUp,  path: '/sales' },
  saas:      { labelKey: 'saas',      Icon: BarChart3,   path: '/saas' },
}

const STORAGE_KEY = 'yippie:sidebarCollapsed'

function resolveOrder(savedOrder: string[] | null | undefined, enabledMods: string[]): string[] {
  const enabled = enabledMods.filter(m => MODULE_MAP[m])
  if (!savedOrder || savedOrder.length === 0) return enabled
  const saved = savedOrder.filter(m => MODULE_MAP[m] && enabled.includes(m))
  const newMods = enabled.filter(m => !saved.includes(m))
  return [...saved, ...newMods]
}

function SortableModItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      className="relative"
    >
      <button
        {...listeners}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/70 cursor-grab active:cursor-grabbing z-10"
        tabIndex={-1}
        onClick={e => e.preventDefault()}
        aria-label="Drag to reorder"
      >
        <GripVertical size={13} />
      </button>
      {children}
    </div>
  )
}

export function Sidebar() {
  const config = useTenantConfig()
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const t = useT()

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

  const [reordering, setReordering] = useState(false)
  const [localOrder, setLocalOrder] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const ctx = useContextMenu()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function enterReorder() {
    setLocalOrder(resolveOrder(user?.sidebar_order, config!.enabled_modules))
    setReordering(true)
  }

  function cancelReorder() {
    setReordering(false)
    setLocalOrder([])
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setLocalOrder(prev => {
        const oldIndex = prev.indexOf(String(active.id))
        const newIndex = prev.indexOf(String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  async function saveOrder() {
    setSaving(true)
    try {
      await api.patch('/auth/me', { sidebar_order: localOrder })
      await refreshUser()
      setReordering(false)
    } catch {
      toast.error('Failed to save sidebar order')
    } finally {
      setSaving(false)
    }
  }

  const { data: draftCount, isFetching: inboxFetching } = useQuery({
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

  const { data: chatCountData } = useQuery({
    queryKey: ['chat-open-count'],
    queryFn: () => api.get('/chat/sessions/count').then((r: any) => r.data),
    refetchInterval: 60_000,
    enabled: !!config && (config.enabled_modules ?? []).includes('chat'),
  })

  const { data: calInvData } = useQuery({
    queryKey: ['calendar-invitation-count'],
    queryFn: () => api.get('/calendar/invitations/pending/count').then((r: any) => r.data),
    refetchInterval: 60_000,
    enabled: !!config && (config.enabled_modules ?? []).includes('calendar'),
  })
  const calInvCount: number = calInvData?.count ?? 0
  const calInvBadge = calInvCount === 0 ? null : calInvCount > 9 ? '9+' : String(calInvCount)


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

  if (!config) return null

  const primaryColor = config.branding.primary_color

  function navCls(isActive: boolean) {
    return `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-white/20 text-white font-semibold'
        : 'text-white/75 hover:bg-white/10 hover:text-white'
    }`
  }

  const orderedMods = reordering ? localOrder : resolveOrder(user?.sidebar_order, config.enabled_modules)

  function renderModNavItem(mod: string) {
    const { labelKey, Icon, path } = MODULE_MAP[mod]
    const label = t(labelKey)
    return (
      <div key={mod}>
        <NavLink
          to={path}
          title={collapsed ? label : undefined}
          className={({ isActive }: any) => navCls(isActive)}
          style={reordering ? { paddingRight: '2rem' } : undefined}
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
          {!collapsed && mod === 'calendar' && calInvBadge && (
            <span className="bg-white/90 text-yippie text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
              {calInvBadge}
            </span>
          )}
        </NavLink>

      </div>
    )
  }

  return (
    <>
      <aside
        onContextMenu={e => { if (collapsed || reordering) return; ctx.open(e, [{ label: 'Reorder sidebar', icon: <GripVertical size={14} />, onClick: enterReorder }]) }}
        className={`hidden md:flex md:flex-col h-screen bg-yippie text-white shrink-0 transition-all duration-200 relative z-10 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
        style={primaryColor ? { backgroundColor: primaryColor } : undefined}
      >

        {/* Workspace header — pinned */}
        <div className={`pt-5 pb-4 shrink-0 ${collapsed ? 'px-2' : 'px-3'}`}>
          <div className="flex items-center gap-3">
            {/* White tile holding the logo mark */}
            <div
              className="shrink-0 flex items-center justify-center bg-white rounded-md"
              style={{ width: 44, height: 44, boxShadow: 'var(--shadow-sm)' }}
            >
              <img
                src="/logo-mark-tight.svg"
                alt="Yippie"
                className="w-7 h-7 object-contain"
              />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="font-display font-bold text-white text-sm leading-tight">Yippie</p>
                <p className="text-white/70 text-xs truncate leading-tight mt-0.5">{config.tenant_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Reorder action bar — pinned */}
        {reordering && !collapsed && (
          <div className="px-2 pb-2 shrink-0 flex gap-1.5">
            <button
              onClick={saveOrder}
              disabled={saving}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Done'}
            </button>
            <button
              onClick={cancelReorder}
              disabled={saving}
              className="text-xs font-medium py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Module nav — scrolls independently */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-2 space-y-0.5">
          {reordering ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedMods} strategy={verticalListSortingStrategy}>
                {orderedMods.map(mod => (
                  <SortableModItem key={mod} id={mod}>
                    {renderModNavItem(mod)}
                  </SortableModItem>
                ))}
              </SortableContext>
            </DndContext>
          ) : (
            orderedMods.map(mod => renderModNavItem(mod))
          )}
        </nav>

        {/* Settings nav — scrolls independently */}
        <div className="border-t border-white/15 px-2 pt-2 pb-1 shrink-0 overflow-y-auto space-y-0.5" style={{ maxHeight: '13rem' }}>
          {user?.role === 'superadmin' && (
            <NavLink
              to="/superadmin/clients"
              title={collapsed ? 'Clients' : undefined}
              className={({ isActive }: any) => navCls(isActive)}
            >
              <Building2 size={16} strokeWidth={2} />
              {!collapsed && <span>Clients</span>}
            </NavLink>
          )}

          <NavLink
            to="/settings/profile"
            title={collapsed ? t('profile') : undefined}
            className={({ isActive }: any) => navCls(isActive)}
          >
            <UserCircle size={16} strokeWidth={2} />
            {!collapsed && <span>{t('profile')}</span>}
          </NavLink>

          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <>
              <NavLink
                to="/settings/workspace"
                title={collapsed ? t('settings') : undefined}
                className={({ isActive }: any) => navCls(isActive)}
              >
                <Settings size={16} strokeWidth={2} />
                {!collapsed && <span>{t('settings')}</span>}
              </NavLink>
              <NavLink
                to="/settings/team"
                title={collapsed ? 'Team' : undefined}
                className={({ isActive }: any) => navCls(isActive)}
              >
                <UsersRound size={16} strokeWidth={2} />
                {!collapsed && <span>Team</span>}
              </NavLink>
            </>
          )}

          {user?.role === 'superadmin' && (
            <NavLink
              to="/settings/superadmins"
              title={collapsed ? 'Superadmins' : undefined}
              className={({ isActive }: any) => navCls(isActive)}
            >
              <ShieldCheck size={16} strokeWidth={2} />
              {!collapsed && <span>Superadmins</span>}
            </NavLink>
          )}
        </div>

        {/* Footer — pinned: email, sign out, collapse */}
        <div className="border-t border-white/15 px-2 py-2 shrink-0">
          {!collapsed && (
            <div className="px-3 pt-1 pb-1">
              <p className="text-white/50 text-[11px] truncate mb-2">{user?.email}</p>
              <button
                onClick={logout}
                className="flex items-center gap-2 w-full text-white/70 hover:text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <LogOut size={14} strokeWidth={2} />
                {t('sign_out')}
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

      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </>
  )
}
