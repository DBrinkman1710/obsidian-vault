import { NavLink } from 'react-router-dom'
import { useTenantConfig } from '../App'
import { useAuth } from '../auth/useAuth'

const MODULE_NAV = [
  { module: 'contacts', label: 'Contacts',  path: '/contacts', icon: '👥' },
  { module: 'tickets',  label: 'Tickets',   path: '/tickets',  icon: '🎫' },
  { module: 'inbox',    label: 'Inbox',     path: '/inbox',    icon: '📬' },
  { module: 'chat',     label: 'Live Chat', path: '/chat',     icon: '💬' },
  { module: 'billing',  label: 'Billing',   path: '/billing',  icon: '💳' },
  { module: 'activity', label: 'Activity',  path: '/activity', icon: '📋' },
]

export function Sidebar() {
  const config = useTenantConfig()
  const { user, logout } = useAuth()
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
        {MODULE_NAV.filter(n => enabled.has(n.module)).map(({ module, label, path, icon }) => (
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
