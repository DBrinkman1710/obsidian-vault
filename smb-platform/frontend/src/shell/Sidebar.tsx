import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTenantConfig } from '../App'
import { useAuth } from '../auth/useAuth'
import { api } from '../api/client'

const ALWAYS_NAV = [
  { module: 'inbox',    label: 'Inbox',     path: '/inbox',    icon: '📬' },
  { module: 'contacts', label: 'Contacts',  path: '/contacts', icon: '👥' },
]

const MODULAR_NAV = [
  { module: 'tickets',  label: 'Tickets',   path: '/tickets',  icon: '🎫' },
  { module: 'activity', label: 'Activity',  path: '/activity', icon: '📋' },
  { module: 'billing',  label: 'Billing',   path: '/billing',  icon: '💳' },
  { module: 'chat',     label: 'Live Chat', path: '/chat',     icon: '💬' },
]

export function Sidebar() {
  const config = useTenantConfig()
  const { user, logout } = useAuth()

  const { data: pendingDrafts } = useQuery({
    queryKey: ['drafts', 'pending'],
    queryFn: () => api.get('/inbox/drafts', { params: { status: 'pending' } }).then(r => r.data),
    refetchInterval: 30_000,
    enabled: !!config,
  })

  const pendingCount: number = pendingDrafts?.length ?? 0
  const badgeLabel = pendingCount === 0 ? null : pendingCount > 9 ? '9+' : String(pendingCount)

  if (!config) return null

  const enabled = new Set(config.enabled_modules)

  const navLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 20px', textDecoration: 'none',
    color: isActive ? '#fff' : '#94a3b8',
    background: isActive ? '#334155' : 'transparent',
    borderLeft: isActive ? `3px solid ${config.branding.primary_color}` : '3px solid transparent',
  })

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: '#1e293b', color: '#f1f5f9',
      display: 'flex', flexDirection: 'column', padding: '24px 0',
    }}>
      <div style={{ padding: '0 20px 24px', fontWeight: 700, fontSize: 16 }}>
        {config.tenant_name}
      </div>

      <nav style={{ flex: 1 }}>
        {ALWAYS_NAV.map(({ module, label, path, icon }) => (
          <NavLink key={module} to={path} style={navLinkStyle}>
            <span>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {module === 'inbox' && badgeLabel && (
              <span style={{
                background: '#ef4444', color: '#fff', borderRadius: 999,
                fontSize: 10, fontWeight: 700, minWidth: 16, height: 16,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 4px',
              }}>
                {badgeLabel}
              </span>
            )}
          </NavLink>
        ))}
        {MODULAR_NAV.filter(n => enabled.has(n.module)).map(({ module, label, path, icon }) => (
          <NavLink key={module} to={path} style={navLinkStyle}>
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid #334155', paddingTop: 8 }}>
        {user?.role === 'admin' && (
          <NavLink to="/settings/departments" style={navLinkStyle}>
            <span>⚙️</span>
            <span>Settings</span>
          </NavLink>
        )}
        <div style={{ padding: '0 12px 8px' }}>
          <p style={{ fontSize: 11, color: '#64748b', margin: '8px 8px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </p>
          <button
            onClick={logout}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6,
              background: 'transparent', color: '#94a3b8',
              border: '1px solid #334155', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, textAlign: 'left',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
