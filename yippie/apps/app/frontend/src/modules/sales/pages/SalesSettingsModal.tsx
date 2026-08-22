import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Code, Copy, Globe, MousePointerClick, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import { CloseButton } from '../../../shell/CloseButton'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useCopy } from '../../../hooks/useCopy'
import { useT } from '../../../hooks/useT'

interface Props {
  onClose: () => void
}

type Tab = 'overview' | 'snippet'

function CopyButton({ text }: { text: string }) {
  const t = useT()
  const { copy, copied } = useCopy({ useToast: false })
  return (
    <button
      onClick={() => copy(text)}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-colors"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      {copied ? t('sales_copied') : t('sales_copy')}
    </button>
  )
}

function OverviewTab() {
  const t = useT()
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {t('sales_overview_intro')}
      </p>

      <div className="space-y-3">
        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-yippie/10 rounded-lg flex items-center justify-center">
            <Code size={16} className="text-yippie" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">{t('sales_overview_step1_title')}</p>
            <p className="text-sm text-slate-500">
              Go to the <strong>Install snippet</strong> tab, copy the one-line{' '}
              <code className="text-xs bg-slate-200 px-1 rounded">&lt;script&gt;</code> tag, and paste it
              inside the <code className="text-xs bg-slate-200 px-1 rounded">&lt;head&gt;</code> of your
              client's website. Each tenant has a unique token. No code changes needed after installation.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Globe size={16} className="text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">{t('sales_overview_step2_title')}</p>
            <p className="text-sm text-slate-500">
              Once the tag is live, every page view is recorded automatically. No extra code needed.
              To track purchases or button clicks, call{' '}
              <code className="text-xs bg-slate-200 px-1 rounded">yippie.track('purchase', {'{'} ... {'}'})</code>{' '}
              anywhere on the page.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <MousePointerClick size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">{t('sales_overview_step3_title')}</p>
            <p className="text-sm text-slate-500">
              When a visitor logs in or places an order, call{' '}
              <code className="text-xs bg-slate-200 px-1 rounded">yippie.identify('email@example.com')</code>.
              Yippie matches the anonymous session to an existing Yippie contact. From that moment,
              the "Website activity" card appears on their ticket detail page.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <TrendingUp size={16} className="text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">{t('sales_overview_step4_title')}</p>
            <p className="text-sm text-slate-500">
              The last 5 website events appear in the <strong>Website activity</strong> card on the right
              side of every ticket from that contact. Agents know what the customer browsed before they
              even read the first line.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SnippetTab() {
  const t = useT()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['sales-token'],
    queryFn: () => api.get('/sales/token').then((r: any) => r.data),
  })

  const rotate = useMutation({
    mutationFn: () => api.post('/sales/token/rotate'),
    onSuccess: () => {
      toast.success(t('sales_rotate_toast'))
      qc.invalidateQueries({ queryKey: ['sales-token'] })
    },
    onError: () => toast.error(t('sales_rotate_error_toast')),
  })

  const token = data?.tracking_token ?? ''
  const scriptTag = token
    ? `<script src="https://getyippie.com/sales.js" data-token="${token}" async></script>`
    : ''

  const usageExample =
    `<!-- Paste inside <head> on every page -->
${scriptTag}

<script>
  // After a customer logs in or places an order:
  yippie.identify('customer@example.com')

  // Track a purchase:
  yippie.track('purchase', { order_id: 'ORD-123', value: 49.99, currency: 'EUR' })

  // Track a button click:
  yippie.track('button_click', { label: 'Add to cart', product: 'Widget Pro' })
</script>`

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Copy the script tag and paste it inside the{' '}
        <code className="text-xs bg-slate-200 px-1 rounded">&lt;head&gt;</code> of your client's website.
        Page views are tracked automatically the moment it loads.
      </p>

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1.5">{t('sales_snippet_script_label')}</p>
        <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="flex-1 text-xs font-mono text-slate-700 break-all leading-relaxed">
            {scriptTag || t('sales_snippet_loading')}
          </p>
          {scriptTag && <CopyButton text={scriptTag} />}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-slate-500">{t('sales_snippet_example_label')}</p>
          {usageExample && <CopyButton text={usageExample} />}
        </div>
        <pre className="text-xs font-mono bg-slate-900 text-slate-200 rounded-xl p-4 overflow-x-auto leading-relaxed">
          {usageExample}
        </pre>
      </div>

      <div className="pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-slate-500">{t('sales_token_label')}</p>
          <span className="text-xs font-mono text-slate-400">{token || '—'}</span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          {t('sales_token_hint')}
        </p>
        <button
          onClick={() => rotate.mutate()}
          disabled={rotate.isPending || !token}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={rotate.isPending ? 'animate-spin' : ''} />
          {t('sales_rotate_btn')}
        </button>
      </div>
    </div>
  )
}

export function SalesSettingsModal({ onClose }: Props) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('overview')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: t('sales_tab_how_it_works'),    icon: <Zap size={13} /> },
    { id: 'snippet',  label: t('sales_tab_install_snippet'), icon: <Code size={13} /> },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={ref} tabIndex={-1} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col outline-none">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">{t('sales_modal_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {tabs.map(tb => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === tb.id
                  ? 'bg-yippie/10 text-yippie'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tb.icon}
              {tb.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'overview' && <OverviewTab />}
          {tab === 'snippet'  && <SnippetTab />}
        </div>

        <div className="px-6 pb-5 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t('sales_modal_close')}
          </button>
        </div>
      </div>
    </div>
  )
}
