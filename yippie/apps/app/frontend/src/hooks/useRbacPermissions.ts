import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export type AccessLevel = 'full' | 'view' | 'restricted'

export function useRbacPermissions(): Record<string, AccessLevel> {
  const { data } = useQuery<{ permissions: Record<string, AccessLevel> }>({
    queryKey: ['rbac-permissions'],
    queryFn: () => api.get('/rbac/my-permissions').then(r => r.data),
    staleTime: 60_000,
  })
  return data?.permissions ?? {}
}
