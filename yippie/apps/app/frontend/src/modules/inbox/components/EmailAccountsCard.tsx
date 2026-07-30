import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { timeAgo } from '../../../lib/format'

// EML1 — linked Gmail/Outlook mailboxes. level='tenant' renders the shared
// mailbox card (admin, Team settings); level='user' the personal one (Profile).

type EmailAccount = {
  id: string
  provider: 'gmail' | 'outlook'
  email_address: string
  display_name: string | null
  user_id: string | null
  status: 'active' | 'error' | 'revoked'
  last_error: string | null
  last_synced_at: string | null
  created_at: string | null
}

const PROVIDER_LABEL: Record<string, string> = { gmail: 'Gmail', outlook: 'Outlook' }

export function EmailAccountsCard({ level }: { level: 'tenant' | 'user' }) {
  const qc = useQueryClient()

  const { data: providers } = useQuery<{ gmail: boolean; outlook: boolean }>({
    queryKey: ['email_account_providers'],
    queryFn: () => api.get('/email_accounts/providers').then((r: any) => r.data),
  })

  const { data: accounts = [] } = useQuery<EmailAccount[]>({
    queryKey: ['email_accounts'],
    queryFn: () => api.get('/email_accounts').then((r: any) => r.data),
  })

  // Success/error toast after the OAuth redirect lands back on this page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('email_link')
    if (!result) return
    if (result === 'success') {
      toast.success('Email account connected')
      qc.invalidateQueries({ queryKey: ['email_accounts'] })
    } else {
      const reason = params.get('reason')
      toast.error(
        reason === 'denied' ? 'Connection cancelled'
        : reason === 'scopes' ? 'Required mailbox permissions were not granted'
        : 'Could not connect the account. Try again.'
      )
    }
    params.delete('email_link')
    params.delete('reason')
    const qs = params.toString()
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
  }, [qc])

  const connectMutation = useMutation({
    mutationFn: (provider: 'gmail' | 'outlook') =>
      api.post('/email_accounts/connect', { provider, level }).then((r: any) => r.data),
    onSuccess: (data: { authorize_url: string }) => { window.location.href = data.authorize_url },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Could not start the connection.'),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/email_accounts/${id}`),
    onSuccess: () => {
      toast.success('Account disconnected')
      qc.invalidateQueries({ queryKey: ['email_accounts'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Could not disconnect the account.'),
  })

  const visible = accounts.filter(a => (level === 'tenant' ? a.user_id === null : a.user_id !== null))
  const anyProvider = Boolean(providers?.gmail || providers?.outlook)

  // Personal card: feature not configured and nothing linked → stay hidden.
  // The tenant card always renders so the shared inbox address stays visible.
  if (level === 'user' && !anyProvider && visible.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-1.5">
        <Mail size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">
          {level === 'tenant' ? 'Shared email account' : 'Connected email accounts'}
        </h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        {level === 'tenant'
          ? 'Link your support mailbox (Gmail or Outlook) so incoming mail lands in the shared inbox and replies are sent from your own address. Optional — without a linked account, Yippie sends via your verified domain.'
          : 'Link your own Gmail or Outlook account. Mail sent to it lands in your Personal inbox, and replies go out from your address and appear in its Sent folder.'}
      </p>

      {level === 'tenant' && <SharedInboxAddress hasLinkedAccount={visible.length > 0} />}

      {visible.length > 0 && (
        <div className="space-y-2 mb-4">
          {visible.map(account => (
            <div key={account.id} className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800 truncate">{account.email_address}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full font-semibold">
                    {PROVIDER_LABEL[account.provider] ?? account.provider}
                  </span>
                  <StatusBadge account={account} />
                </div>
                {account.last_synced_at && (
                  <p className="mt-0.5 text-xs text-slate-400">Last synced {timeAgo(account.last_synced_at)}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {account.status === 'revoked' && (
                  <button
                    type="button"
                    onClick={() => connectMutation.mutate(account.provider)}
                    disabled={connectMutation.isPending}
                    className="px-3 py-1.5 bg-yippie text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    Reconnect
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Disconnect ${account.email_address}? Mail will no longer sync from this account.`)) {
                      disconnectMutation.mutate(account.id)
                    }
                  }}
                  disabled={disconnectMutation.isPending}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:text-red-500 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                  title="Disconnect"
                >
                  <Unlink size={13} /> Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {anyProvider && (
        <div className="flex items-center gap-2">
          {providers?.gmail && (
            <button
              type="button"
              onClick={() => connectMutation.mutate('gmail')}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Mail size={15} className="text-red-500" /> Connect Gmail
            </button>
          )}
          {providers?.outlook && (
            <button
              type="button"
              onClick={() => connectMutation.mutate('outlook')}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-sm font-semibold text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
            >
              <Mail size={15} className="text-sky-600" /> Connect Outlook
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Tenant shared inbox receiving address (Tenant.inbound_email). Auto created
// from the workspace name; admins can override it. When a Gmail/Outlook account
// is linked above, that account takes over and this address is a fallback.
function SharedInboxAddress({ hasLinkedAccount }: { hasLinkedAccount: boolean }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const { data } = useQuery<{ inbound_email: string | null }>({
    queryKey: ['workspace-prefs'],
    queryFn: () => api.get('/team/workspace-prefs').then((r: any) => r.data),
    enabled: isAdmin,
  })

  const current = data?.inbound_email ?? ''
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  const saveMut = useMutation({
    mutationFn: (addr: string) =>
      api.patch('/team/workspace-prefs', { inbound_email: addr }).then((r: any) => r.data),
    onSuccess: () => {
      toast.success('Shared inbox address updated')
      qc.invalidateQueries({ queryKey: ['workspace-prefs'] })
      setEditing(false)
    },
    onError: (err: any) => toast.error(err.response?.data?.detail ?? 'Could not update the address.'),
  })

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">Shared inbox address</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Mail sent here lands in your shared inbox. Created automatically from your workspace name.</p>
        </div>
        {isAdmin && !editing && (
          <button
            type="button"
            onClick={() => { setValue(current); setEditing(true) }}
            className="shrink-0 text-xs font-semibold text-yippie hover:underline cursor-pointer"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2.5 flex items-center gap-2">
          <input
            type="email"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="support@getyippie.com"
            className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
          <button
            type="button"
            onClick={() => saveMut.mutate(value)}
            disabled={saveMut.isPending}
            className="shrink-0 px-3 py-1.5 bg-yippie text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="shrink-0 px-2.5 py-1.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <p className={`mt-1.5 text-sm font-mono truncate ${hasLinkedAccount ? 'text-slate-400' : 'text-slate-800'}`}>
          {current || <span className="font-sans text-slate-400">Not set</span>}
        </p>
      )}

      {hasLinkedAccount && (
        <p className="mt-2 text-[11px] text-warning-600">
          A connected account below is active, so incoming mail syncs from it and replies go out from that address. This Yippie address stays as a fallback.
        </p>
      )}
    </div>
  )
}

function StatusBadge({ account }: { account: EmailAccount }) {
  if (account.status === 'active') {
    return <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-semibold">Active</span>
  }
  if (account.status === 'error') {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full font-semibold"
        title={account.last_error ?? undefined}
      >
        Sync error
      </span>
    )
  }
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-500 rounded-full font-semibold"
      title={account.last_error ?? 'Access was revoked — reconnect to resume syncing.'}
    >
      Disconnected
    </span>
  )
}

