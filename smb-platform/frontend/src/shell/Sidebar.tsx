import { NavLink } from 'react-router-dom'
import { useTenantConfig } from '../App'

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
  if (!config) return null

  const enabled = new Set(config.enabled_modules)

  return (
    <aside style={{
      width: 220, minHeight: '100vh', background: '#1e293b', color: '#f1f5f9',
      display: 'flex', flexDirection: 'column', padding: '24px 0',
    }}>
      <div style={{ padding: '0 20px 24px', fontWeight: 700, fontSize: 16 }}>
        {config.tenant_name}
      </div>
      <nav>
        {MODULE_NAV.filter(n => enabled.has(n.module)).map(({ module, label, path, icon }) => (
          <NavLink
            key={module}
            to={path}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px', textDecoration: 'none',
              color: isActive ? '#fff' : '#94a3b8',
              background: isActive ? '#334155' : 'transparent',
              borderLeft: isActive ? `3px solid ${config.branding.primary_color}` : '3px solid transparent',
            })}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
