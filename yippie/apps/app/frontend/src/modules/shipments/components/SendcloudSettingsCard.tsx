import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useT } from '../../../hooks/useT'

export function SendcloudSettingsCard() {
  const t = useT()
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

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = {}
      if (apiKey !== '••••••••') payload.sendcloud_api_key = apiKey || null
      if (apiSecret !== '••••••••') payload.sendcloud_api_secret = apiSecret || null
      return api.patch('/shipments/settings/sendcloud', payload)
    },
    onSuccess: () => {
      toast.success(t('ship_sc_saved_toast'))
      qc.invalidateQueries({ queryKey: ['shipments-sendcloud-settings'] })
    },
    onError: () => toast.error(t('ship_sc_save_error_toast')),
  })

  const dirty =
    (apiKey !== '••••••••' && apiKey !== (data?.sendcloud_api_key_set ? '••••••••' : '')) ||
    (apiSecret !== '••••••••' && apiSecret !== (data?.sendcloud_api_secret_set ? '••••••••' : ''))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Package size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">{t('ship_card_title')}</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        {t('ship_card_intro').replace('{path}', '')}
        <span className="font-medium text-slate-700">Settings → Integrations → Sendcloud API</span>.
      </p>

      {data?.sendcloud_webhook_url && (
        <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 mb-1">{t('ship_card_webhook_url_label')}</p>
          <p className="text-xs font-mono text-slate-700 break-all">{data.sendcloud_webhook_url}</p>
          <p className="text-xs text-slate-400 mt-1">{t('ship_card_webhook_hint')}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('ship_sc_public_key_label')}</label>
          <input
            type="password"
            value={apiKey}
            onFocus={() => { if (apiKey === '••••••••') setApiKey('') }}
            onChange={e => setApiKey(e.target.value)}
            placeholder={t('ship_sc_public_key_ph')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('ship_sc_secret_key_label')}</label>
          <input
            type="password"
            value={apiSecret}
            onFocus={() => { if (apiSecret === '••••••••') setApiSecret('') }}
            onChange={e => setApiSecret(e.target.value)}
            placeholder={t('ship_sc_secret_key_ph')}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
      </div>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !dirty}
        className="px-4 py-1.5 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
      >
        {mutation.isPending ? t('ship_sc_saving') : t('ship_sc_save')}
      </button>
    </div>
  )
}
