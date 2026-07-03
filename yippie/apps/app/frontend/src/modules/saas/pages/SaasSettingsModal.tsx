import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Check, Code, Copy, Layers, UserCheck, X, Zap } from 'lucide-react'
import { api } from '../../../api/client'

interface Props {
  onClose: () => void
}

type Tab = 'overview' | 'snippet'

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
        The Product Analytics snippet tracks how customers use your SaaS product: feature adoption,
        onboarding completion, and errors. Every ticket from a tracked customer arrives with a silent
        briefing: what they've done, what they've skipped, where they got stuck.
      </p>

      <div className="space-y-3">
        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-yippie/10 rounded-lg flex items-center justify-center">
            <Code size={16} className="text-yippie" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">1. Add the snippet</p>
            <p className="text-sm text-slate-500">
              Copy the one-line{' '}
              <code className="text-xs bg-slate-200 px-1 rounded">&lt;script&gt;</code> tag from the{' '}
              <strong>Install snippet</strong> tab and paste it into your SaaS product's HTML, just
              before the closing <code className="text-xs bg-slate-200 px-1 rounded">&lt;/body&gt;</code>{' '}
              or inside <code className="text-xs bg-slate-200 px-1 rounded">&lt;head&gt;</code>.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <UserCheck size={16} className="text-blue-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">2. Identify users after login</p>
            <p className="text-sm text-slate-500">
              Call{' '}
              <code className="text-xs bg-slate-200 px-1 rounded">
                yippie.identify('user-id', {'{'} email: '…', name: '…', plan: '…' {'}'})
              </code>{' '}
              right after a user logs in. Yippie links the browser session to a Yippie contact by email,
              so all events are attributed to the right person.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <Layers size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">3. Track what matters</p>
            <p className="text-sm text-slate-500">
              Call <code className="text-xs bg-slate-200 px-1 rounded">yippie.track(eventType, props)</code>{' '}
              for the moments that matter: feature usage, onboarding steps completed or skipped, errors
              encountered, and upgrade intent (when a user visits your pricing page). The full event
              taxonomy is shown in the Install snippet tab.
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex-shrink-0 w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <BarChart3 size={16} className="text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 mb-0.5">4. Health scores + agent context</p>
            <p className="text-sm text-slate-500">
              Yippie computes a health score (0–100) for each tracked customer every hour, based on
              how recently they were active, how many features they use, and how many errors they hit.
              The score and last 4 events appear in the <strong>Product usage</strong> card on every
              ticket, so agents walk into every conversation already informed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SnippetTab() {
  const { data } = useQuery({
    queryKey: ['saas-token'],
    queryFn: () => api.get('/saas/token').then((r: any) => r.data),
  })

  const token = data?.tracking_token ?? ''
  const scriptTag = token
    ? `<script src="https://getyippie.com/saas.js" data-token="${token}" async></script>`
    : ''

  const usageExample =
    `<!-- Paste inside <head> or before </body> in your product -->
${scriptTag}

<script>
  // After the user logs in — links events to a Yippie contact:
  yippie.identify('user-123', {
    email: 'jan@acme.nl',
    name: 'Jan',
    plan: 'starter',
  })

  // When a feature is used:
  yippie.track('feature_used', { feature: 'csv_export' })

  // When an onboarding step completes or is skipped:
  yippie.track('onboarding_step', { step: 'connect_inbox', status: 'completed' })
  yippie.track('onboarding_step', { step: 'invite_team',   status: 'skipped' })

  // When an error occurs:
  yippie.track('error_encountered', { code: 'QUOTA_EXCEEDED', feature: 'ai_scan' })

  // When a user visits your pricing/upgrade page:
  yippie.track('upgrade_intent', { page: '/pricing' })
</script>`

  const eventTypes = [
    { name: 'feature_used',      props: 'feature (string)' },
    { name: 'onboarding_step',   props: 'step (string), status: "completed" | "skipped" | "abandoned"' },
    { name: 'error_encountered', props: 'code (string), feature (string)' },
    { name: 'upgrade_intent',    props: 'page (string)' },
    { name: 'feature_abandoned', props: 'feature (string), steps_completed (number)' },
  ]

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        Copy the script tag and paste it into your SaaS product. Then call{' '}
        <code className="text-xs bg-slate-200 px-1 rounded">yippie.identify()</code> after login
        and <code className="text-xs bg-slate-200 px-1 rounded">yippie.track()</code> at key moments.
      </p>

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1.5">Script tag</p>
        <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="flex-1 text-xs font-mono text-slate-700 break-all leading-relaxed">
            {scriptTag || 'Loading…'}
          </p>
          {scriptTag && <CopyButton text={scriptTag} />}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-slate-500">Full example</p>
          {usageExample && <CopyButton text={usageExample} />}
        </div>
        <pre className="text-xs font-mono bg-slate-900 text-slate-200 rounded-xl p-4 overflow-x-auto leading-relaxed">
          {usageExample}
        </pre>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">Supported event types</p>
        <div className="space-y-1.5">
          {eventTypes.map(e => (
            <div key={e.name} className="flex items-start gap-3 text-xs">
              <code className="shrink-0 bg-slate-100 px-2 py-0.5 rounded font-mono text-slate-700 w-44">
                {e.name}
              </code>
              <span className="text-slate-500 pt-0.5">{e.props}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Your token: <code className="font-mono">{token || '—'}</code>
        </p>
      </div>
    </div>
  )
}

export function SaasSettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('overview')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'How it works',   icon: <Zap size={13} /> },
    { id: 'snippet',  label: 'Install snippet', icon: <Code size={13} /> },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={ref} tabIndex={-1} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col outline-none">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Product Analytics: Settings</h2>
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
          {tab === 'overview' && <OverviewTab />}
          {tab === 'snippet'  && <SnippetTab />}
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
