import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Package, RefreshCw, Truck, Webhook, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'

interface Props {
  onClose: () => void
}

type Tab = 'overview' | 'erp' | 'sendcloud'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-colors"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function OverviewTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Track &amp; Trace collects shipment data from three sources. You can use any combination.
      </p>
      <div className="space-y-3">
        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-yippie/10 rounded-lg flex items-center justify-center">
            <Package size={16} className="text-yippie" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">Manual entry</p>
            <p className="text-sm text-slate-500">
              Agents add shipments directly in this screen — tracking number, carrier, and order reference.
              Useful for one-offs or when automation isn't set up yet.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Webhook size={16} className="text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">ERP / order system webhook</p>
            <p className="text-sm text-slate-500">
              Your ERP or webshop (Exact, AFAS, WooCommerce, Shopify, …) posts an order event to a Yippie
              URL whenever a shipment is created or its status changes. Yippie matches on{' '}
              <code className="text-xs bg-slate-200 px-1 rounded">order_number</code> and keeps the shipment
              in sync automatically. See the <strong>ERP webhook</strong> tab for the URL and payload format.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <Truck size={16} className="text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">Sendcloud (carrier events)</p>
            <p className="text-sm text-slate-500">
              If you ship via Sendcloud, connect your account in the <strong>Sendcloud</strong> tab.
              Sendcloud pushes live carrier events (picked up, in transit, delivered) directly to Yippie —
              no polling needed. You can also manually refresh any shipment from its detail page.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErpTab() {
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['shipments-webhook-settings'],
    queryFn: () => api.get('/shipments/settings/webhook').then((r: any) => r.data),
  })

  const rotate = useMutation({
    mutationFn: () => api.post('/shipments/settings/webhook/rotate'),
    onSuccess: () => {
      toast.success('Webhook secret rotated')
      qc.invalidateQueries({ queryKey: ['shipments-webhook-settings'] })
    },
    onError: () => toast.error('Failed to rotate secret'),
  })

  const examplePayload = JSON.stringify({
    order_number: 'ORD-12345',
    tracking_number: '3SYZX2000001234',
    carrier: 'postnl',
    status: 'in_transit',
    contact_email: 'customer@example.com',
    description: 'Parcel picked up by carrier',
    estimated_delivery: '2026-06-25T00:00:00Z',
  }, null, 2)

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Give your ERP or webshop this webhook URL. It should POST a JSON body whenever an order is
        shipped or its status changes. Yippie creates or updates the matching shipment automatically.
      </p>

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Webhook URL</p>
        <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="flex-1 text-xs font-mono text-slate-700 break-all">
            {data?.orders_webhook_url ?? '—'}
          </p>
          {data?.orders_webhook_url && <CopyButton text={data.orders_webhook_url} />}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-slate-500">Shared secret (optional)</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${data?.orders_webhook_secret_set ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
            {data?.orders_webhook_secret_set ? 'Configured' : 'Not set'}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          When set, your ERP must send the secret as an{' '}
          <code className="bg-slate-100 px-1 rounded">X-Api-Key</code> header.
          Requests without it are rejected.
        </p>
        <button
          onClick={() => rotate.mutate()}
          disabled={rotate.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={rotate.isPending ? 'animate-spin' : ''} />
          {data?.orders_webhook_secret_set ? 'Rotate secret' : 'Generate secret'}
        </button>
        {data?.orders_webhook_secret_set && (
          <p className="text-xs text-slate-400 mt-2">
            Rotating generates a new secret — update your ERP immediately after.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-slate-500">Payload format</p>
          <CopyButton text={examplePayload} />
        </div>
        <pre className="text-xs font-mono bg-slate-900 text-slate-200 rounded-xl p-4 overflow-x-auto leading-relaxed">
          {examplePayload}
        </pre>
        <p className="text-xs text-slate-400 mt-2">
          Only <code className="bg-slate-100 px-1 rounded">order_number</code> is required.
          Valid <code className="bg-slate-100 px-1 rounded">carrier</code> values:{' '}
          <code className="bg-slate-100 px-1 rounded">postnl</code>{' '}
          <code className="bg-slate-100 px-1 rounded">dhl</code>{' '}
          <code className="bg-slate-100 px-1 rounded">dpd</code>{' '}
          <code className="bg-slate-100 px-1 rounded">ups</code>{' '}
          <code className="bg-slate-100 px-1 rounded">fedex</code>{' '}
          <code className="bg-slate-100 px-1 rounded">sendcloud</code>{' '}
          <code className="bg-slate-100 px-1 rounded">other</code>.
          Valid <code className="bg-slate-100 px-1 rounded">status</code> values:{' '}
          <code className="bg-slate-100 px-1 rounded">registered</code>{' '}
          <code className="bg-slate-100 px-1 rounded">in_transit</code>{' '}
          <code className="bg-slate-100 px-1 rounded">out_for_delivery</code>{' '}
          <code className="bg-slate-100 px-1 rounded">delivered</code>{' '}
          <code className="bg-slate-100 px-1 rounded">exception</code>{' '}
          <code className="bg-slate-100 px-1 rounded">returned</code>{' '}
          <code className="bg-slate-100 px-1 rounded">cancelled</code>.
        </p>
      </div>
    </div>
  )
}

function SendcloudTab() {
  const qc = useQueryClient()
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')

  const { data } = useQuery({
    queryKey: ['shipments-sendcloud-settings'],
    queryFn: () => api.get('/shipments/settings/sendcloud').then((r: any) => r.data),
  })

  useEffect(() => {
    if (data) {
      setApiKey(data.sendcloud_api_key_set ? '••••••••' : '')
      setApiSecret(data.sendcloud_api_secret_set ? '••••••••' : '')
    }
  }, [data])

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = {}
      if (apiKey !== '••••••••') payload.sendcloud_api_key = apiKey || null
      if (apiSecret !== '••••••••') payload.sendcloud_api_secret = apiSecret || null
      return api.patch('/shipments/settings/sendcloud', payload)
    },
    onSuccess: () => {
      toast.success('Sendcloud settings saved')
      qc.invalidateQueries({ queryKey: ['shipments-sendcloud-settings'] })
    },
    onError: () => toast.error('Failed to save Sendcloud settings'),
  })

  const dirty =
    (apiKey !== '••••••••' && apiKey !== (data?.sendcloud_api_key_set ? '••••••••' : '')) ||
    (apiSecret !== '••••••••' && apiSecret !== (data?.sendcloud_api_secret_set ? '••••••••' : ''))

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Connect your Sendcloud account to receive live carrier status updates. Find your API keys
        in Sendcloud under <span className="font-medium text-slate-700">Settings → Integrations → Sendcloud API</span>.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Public key</label>
          <input
            type="password"
            value={apiKey}
            onFocus={() => { if (apiKey === '••••••••') setApiKey('') }}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Sendcloud public key"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Secret key</label>
          <input
            type="password"
            value={apiSecret}
            onFocus={() => { if (apiSecret === '••••••••') setApiSecret('') }}
            onChange={e => setApiSecret(e.target.value)}
            placeholder="Sendcloud secret key"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending || !dirty}
        className="px-4 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
      >
        {save.isPending ? 'Saving…' : 'Save'}
      </button>

      {data?.sendcloud_webhook_url && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Sendcloud webhook URL</p>
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="flex-1 text-xs font-mono text-slate-700 break-all">
              {data.sendcloud_webhook_url}
            </p>
            <CopyButton text={data.sendcloud_webhook_url} />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Register this URL in Sendcloud under{' '}
            <span className="font-medium text-slate-600">Settings → Webhooks</span>.
            Sendcloud will POST carrier events to Yippie in real time.
          </p>
        </div>
      )}
    </div>
  )
}

export function ShipmentSettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'How it works', icon: <Zap size={13} /> },
    { id: 'erp',      label: 'ERP webhook',  icon: <Webhook size={13} /> },
    { id: 'sendcloud',label: 'Sendcloud',     icon: <Truck size={13} /> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} tabIndex={-1} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col outline-none">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Track &amp; Trace — Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === t.id
                  ? 'bg-yippie/10 text-yippie'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'overview'  && <OverviewTab />}
          {tab === 'erp'       && <ErpTab />}
          {tab === 'sendcloud' && <SendcloudTab />}
        </div>

        <div className="px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
