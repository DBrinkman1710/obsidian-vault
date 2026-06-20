import { createContext, useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { useTenantConfig } from '../App'
import { useRbacPermissions } from '../hooks/useRbacPermissions'

interface Props {
  module: string
  children: React.ReactNode
}

/** True inside a module rendered in view-only (RBAC 'view') mode. */
export const RbacViewModeContext = createContext(false)

export function useIsViewOnly() {
  return useContext(RbacViewModeContext)
}

export function ModuleGate({ module, children }: Props) {
  const config = useTenantConfig()
  const permissions = useRbacPermissions()

  if (!config) return null
  if (!config.enabled_modules.includes(module)) {
    return <Navigate to="/" replace />
  }

  const level = permissions[module] ?? 'full'

  if (level === 'restricted') {
    return <Navigate to="/" replace />
  }

  if (level === 'view') {
    return (
      <RbacViewModeContext.Provider value={true}>
        {children}
      </RbacViewModeContext.Provider>
    )
  }

  return <>{children}</>
}
