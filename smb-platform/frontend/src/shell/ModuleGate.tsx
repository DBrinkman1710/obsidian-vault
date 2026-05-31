import { Navigate } from 'react-router-dom'
import { useTenantConfig } from '../App'

interface Props {
  module: string
  children: React.ReactNode
}

export function ModuleGate({ module, children }: Props) {
  const config = useTenantConfig()
  if (!config) return null
  if (!config.enabled_modules.includes(module)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
