import { useQuery } from '@tanstack/react-query'
import { AnalyticsRecipient, Campaign, marketingApi, VariantStats } from '../api'

const STATUS_TONE: Record<AnalyticsRecipient['status'], string> = {
  sent: 'bg-slate-100 text-slate-600',
  opened: 'bg-blue-50 text-blue-700',
  clicked: 'bg-indigo-50 text-indigo-700',
  replied: 'bg-emerald-50 text-emerald-700',
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

function VariantBar({ v, max }: { v: VariantStats; max: number; isWinner: boolean }) {
  const openRate = v.sent ? Math.round((100 * v.opened) / v.sent) : 0
  const width = max ? Math.round((100 * v.opened) / max) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase text-slate-700">Variant {v.variant}</span>
        <span className="text-slate-500">
          {openRate}% open · {v.sent} sent
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

export function AnalyticsTab({ campaign }: { campaign: Campaign }) {
  const { data, isLoading } = useQuery({
    queryKey: ['marketing', 'analytics', campaign.id],
    queryFn: () => marketingApi.getAnalytics(campaign.id),
    refetchInterval: campaign.status === 'sending' ? 15000 : false,
  })

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-slate-400">Loading analytics…</div>
  }

  const maxOpened = Math.max(1, ...data.variants.map((v) => v.opened))

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Sent" value={data.sent} />
          <Stat label="Opened" value={`${data.open_rate}%`} sub={`${data.opened} contacts`} />
          <Stat label="Clicked" value={`${data.click_rate}%`} sub={`${data.clicked} contacts`} />
          <Stat label="Replied" value={`${data.reply_rate}%`} sub={`${data.replied} contacts`} />
          <Stat label="Opt-outs" value={data.unsubscribed} />
        </div>

        {data.variants.length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">A/B performance</h3>
              {data.ab_winner && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold uppercase text-emerald-700">
                  Winner: {data.ab_winner}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {data.variants.map((v) => (
                <VariantBar key={v.variant} v={v} max={maxOpened} isWinner={data.ab_winner === v.variant} />
              ))}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Recipient</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Variant</th>
                <th className="px-4 py-2.5">Reply</th>
              </tr>
            </thead>
            <tbody>
              {data.recipients.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.recipient_email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_TONE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs uppercase text-slate-500">{r.variant ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.reply_classification ?? '—'}</td>
                </tr>
              ))}
              {data.recipients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                    No recipients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
