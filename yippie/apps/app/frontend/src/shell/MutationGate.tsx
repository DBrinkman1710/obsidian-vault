import { useIsViewOnly } from './ModuleGate'

interface Props {
  children: React.ReactNode
}

/**
 * Renders nothing when the current module is in RBAC view-only mode.
 * Wrap any mutation controls (buttons, forms, action menus) with this.
 */
export function MutationGate({ children }: Props) {
  const viewOnly = useIsViewOnly()
  if (viewOnly) return null
  return <>{children}</>
}
