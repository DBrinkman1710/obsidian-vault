import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Calendar, Mail, MessageCircle, Send } from 'lucide-react'
import { Campaign, Channel, marketingApi } from '../api'

export function ScheduleTab({ campaign }: { campaign: Campaign }) {
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

  const launch = useMutation({
    mutationFn: () => marketingApi.launch(campaign.id, { enable_ab: enableAb }),
    onSuccess: (r: any) => {
      toast.success(`Launched to ${r.recipients} recipient${r.recipients === 1 ? '' : 's'}`)
      invalidate()
    },
    onError: () => toast.error('Could not launch campaign'),
  })

  const schedule = useMutation({
    mutationFn: () => marketingApi.schedule(campaign.id, new Date(when).toISOString()),
    onSuccess: () => {
      toast.success('Campaign scheduled')
      invalidate()
    },
    onError: () => toast.error('Could not schedule campaign'),
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
          <h3 className="text-sm font-semibold text-slate-900">Channel</h3>
          <p className="mt-0.5 text-xs text-slate-400">How this campaign goes out.</p>
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
              <h3 className="text-sm font-semibold text-slate-900">A/B test</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Send variants A and B to the first half. The winner (by open rate) goes to the rest 2 hours later.
              </p>
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

        {/* Launch now */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Launch now</h3>
          <p className="mt-0.5 text-xs text-slate-400">Send to your saved audience immediately.</p>
          <button
            onClick={() => {
              if (confirm('Send this campaign now?')) launch.mutate()
            }}
            disabled={locked || launch.isPending}
            className="mt-3 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send size={15} /> {launch.isPending ? 'Launching…' : 'Launch now'}
          </button>
        </section>

        {/* Schedule */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Schedule for later</h3>
          <p className="mt-0.5 text-xs text-slate-400">Pick a date and time — it sends automatically.</p>
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
              {schedule.isPending ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
          {campaign.status === 'scheduled' && campaign.scheduled_at && (
            <p className="mt-2 text-xs font-medium text-blue-600">
              Scheduled for {new Date(campaign.scheduled_at).toLocaleString()}
            </p>
          )}
        </section>

        {locked && (
          <p className="text-center text-xs text-slate-400">
            This campaign is {campaign.status}. Scheduling and channel are locked.
          </p>
        )}
      </div>
    </div>
  )
}
