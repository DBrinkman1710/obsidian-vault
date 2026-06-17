import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Palette, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useTenantConfig } from '../../../App'

const DEFAULT_COLOR = '#5BA4F5'

function OrgDetailsCard() {
  const [kvk, setKvk] = useState('')
  const [btw, setBtw] = useState('')

  const { data } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.get('/team/org-settings').then(r => r.data),
  })
  useEffect(() => {
    if (data) { setKvk(data.kvk_nummer ?? ''); setBtw(data.btw_nummer ?? '') }
  }, [data])

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/org-settings', { kvk_nummer: kvk, btw_nummer: btw }),
    onSuccess: () => toast.success('Organisation details saved'),
    onError: () => toast.error('Failed to save'),
  })

  const dirty = kvk !== (data?.kvk_nummer ?? '') || btw !== (data?.btw_nummer ?? '')

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={16} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">Organisation details</h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Your Dutch registration numbers. These appear on invoice exports.
      </p>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">KvK-nummer</label>
          <input
            value={kvk}
            onChange={e => setKvk(e.target.value)}
            placeholder="12345678"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Btw-nummer</label>
          <input
            value={btw}
            onChange={e => setBtw(e.target.value)}
            placeholder="NL123456789B01"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
          />
        </div>
      </div>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !dirty}
        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {mutation.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

export default function LabelsPage() {
  const config = useTenantConfig()
  const [color, setColor] = useState(config?.branding?.primary_color ?? DEFAULT_COLOR)
  const [saved, setSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.patch('/team/branding', { primary_color: color }),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      window.location.reload()
    },
  })

  return (
    <div className="max-w-3xl">
      <OrgDetailsCard />
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Palette size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Brand colour</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          The accent colour used throughout the sidebar and interface for your workspace.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={e => { setColor(e.target.value); setSaved(false) }}
            className="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5"
          />
          <span className="text-sm text-slate-500 font-mono">{color}</span>
          <button
            type="button"
            onClick={() => { setColor(DEFAULT_COLOR); setSaved(false) }}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 px-2.5 py-1 rounded-lg transition-colors"
          >
            Reset to default
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || color === (config?.branding?.primary_color ?? DEFAULT_COLOR)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {mutation.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        {mutation.isError && <p className="mt-2 text-xs text-red-500">Failed to save — try again.</p>}
      </div>
    </div>
  )
}
