import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Calendar, FlaskConical, Mail, MessageCircle, Send } from 'lucide-react'
import { Campaign, Channel, marketingApi } from '../api'
import { useT } from '../../../hooks/useT'

export function ScheduleTab({ campaign }: { campaign: Campaign }) {
  const t = useT()
  const qc = useQueryClient()
  const [enableAb, setEnableAb] = useState(true)
  const [channel, setChannel] = useState<Channel>(campaign.dispatch_channel)
  const [when, setWhen] = useState('')

  const locked = campaign.status === 'sending' || campaign.status === 'completed'

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
    qc.invalidateQueries({ queryKey: ['marketing', 'campaign', campaign.id] })
  }

  const setChannelMut = useMutation({
    mutationFn: (c: Channel) => marketingApi.updateCampaign(campaign.id, { dispatch_channel: c }),
    onSuccess: () => invalidate(),
  })

  const testSend = useMutation({
    mutationFn: () => marketingApi.testSend(campaign.id),
    onSuccess: (r: any) => toast.success(`${t('mkt_test_sent_to')} ${r.to}`),
    onError: () => toast.error(t('mkt_test_send_err')),
  })

  const launch = useMutation({
    mutationFn: () => marketingApi.launch(campaign.id, { enable_ab: enableAb }),
    onSuccess: (r: any) => {
      const recipientLabel = r.recipients === 1 ? t('mkt_launched_recipients') : t('mkt_launched_recipients_pl')
      toast.success(`Launched to ${r.recipients} ${recipientLabel}`)
      invalidate()
    },
    onError: () => toast.error(t('mkt_launch_err')),
  })

  const schedule = useMutation({
    mutationFn: () => marketingApi.schedule(campaign.id, new Date(when).toISOString()),
    onSuccess: () => {
      toast.success(t('mkt_campaign_scheduled'))
      invalidate()
    },
    onError: () => toast.error(t('mkt_schedule_err')),
  })

  function pickChannel(c: Channel) {
    setChannel(c)
    setChannelMut.mutate(c)
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Channel */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('mkt_channel_heading')}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{t('mkt_channel_desc')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['email', 'whatsapp'] as Channel[]).map((c) => (
              <button
                key={c}
                disabled={locked}
                onClick={() => pickChannel(c)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors disabled:opacity-50 ${
                  channel === c ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c === 'email' ? <Mail size={15} /> : <MessageCircle size={15} />}
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* A/B */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t('mkt_ab_test_heading')}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{t('mkt_ab_test_desc')}</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={enableAb}
                disabled={locked}
                onChange={(e) => setEnableAb(e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
            </label>
          </div>
        </section>

        {/* Test send */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('mkt_test_send_heading')}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{t('mkt_test_send_desc')}</p>
          <button
            onClick={() => testSend.mutate()}
            disabled={testSend.isPending}
            className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            <FlaskConical size={15} /> {testSend.isPending ? t('mkt_sending') : t('mkt_send_test')}
          </button>
        </section>

        {/* Launch now */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('mkt_launch_now_heading')}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{t('mkt_launch_now_desc')}</p>
          <button
            onClick={() => {
              if (confirm(t('mkt_launch_confirm'))) launch.mutate()
            }}
            disabled={locked || launch.isPending}
            className="mt-3 flex items-center gap-2 rounded-xl bg-yippie px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Send size={15} /> {launch.isPending ? t('mkt_launching') : t('mkt_launch_now')}
          </button>
        </section>

        {/* Schedule */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">{t('mkt_schedule_heading')}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{t('mkt_schedule_desc')}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                value={when}
                disabled={locked}
                onChange={(e) => setWhen(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:outline-none disabled:opacity-50"
              />
            </div>
            <button
              onClick={() => schedule.mutate()}
              disabled={locked || !when || schedule.isPending}
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {schedule.isPending ? t('mkt_scheduling') : t('mkt_schedule_btn')}
            </button>
          </div>
          {campaign.status === 'scheduled' && campaign.scheduled_at && (
            <p className="mt-2 text-xs font-medium text-blue-600">
              {t('mkt_scheduled_for')} {new Date(campaign.scheduled_at).toLocaleString()}
            </p>
          )}
        </section>

        {locked && (
          <p className="text-center text-xs text-slate-400">
            {t('mkt_locked_notice').replace('{status}', campaign.status)}
          </p>
        )}
      </div>
    </div>
  )
}
