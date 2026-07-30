import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'

// EML1 — linked Gmail/Outlook mailboxes usable as a From address.
export type LinkedEmailAccount = {
  id: string
  provider: 'gmail' | 'outlook'
  email_address: string
  user_id: string | null
  status: 'active' | 'error' | 'revoked'
}

export const PROVIDER_SHORT: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook' }

/** Active linked accounts visible to this user (own + tenant-level shared). */
export function useLinkedEmailAccounts(): LinkedEmailAccount[] {
  const { data = [] } = useQuery<LinkedEmailAccount[]>({
    queryKey: ['email_accounts'],
    queryFn: () => api.get('/email_accounts').then((r: any) => r.data),
    staleTime: 5 * 60_000,
  })
  return data.filter(a => a.status === 'active')
}
