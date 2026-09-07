import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Clock, Plus, Trash2 } from 'lucide-react'
import { Campaign, marketingApi } from '../api'
import { useT } from '../../../hooks/useT'

export function DripTab({ campaign }: { campaign: Campaign }) {
  const t = useT()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [delay, setDelay] = useState(3)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const { data: steps = [] } = useQuery({
    queryKey: ['marketing', 'sequences', campaign.id],
    queryFn: () => marketingApi.listSequences(campaign.id),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['marketing', 'sequences', campaign.id] })
  }

  const add = useMutation({
    mutationFn: () =>
      marketingApi.addSequence(campaign.id, { delay_days: delay, subject: subject.trim(), html_body: body.trim() }),
    onSuccess: () => {
      toast.success(t('mkt_step_added'))
      setShowForm(false)
      setSubject('')
      setBody('')
      setDelay(3)
      invalidate()
    },
    onError: () => toast.error(t('mkt_step_add_err')),
  })

  const remove = useMutation({
    mutationFn: (id: string) => marketingApi.deleteSequence(campaign.id, id),
    onSuccess: () => {
      toast.success(t('mkt_step_removed'))
      invalidate()
    },
  })

  const valid = subject.trim().length > 0 && body.trim().length > 0

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t('mkt_drip_heading')}</h3>
            <p className="mt-0.5 text-xs text-slate-400">{t('mkt_drip_desc')}</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 rounded-lg bg-yippie px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> {t('mkt_add_step')}
          </button>
        </div>

        {showForm && (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('mkt_send_after_days')}</label>
              <input
                type="number"
                min={0}
                max={365}
                value={delay}
                onChange={(e) => setDelay(Math.max(0, Number(e.target.value)))}
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('mkt_subject_drip_label')}</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('mkt_subject_still')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t('mkt_body_label')}</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder={t('mkt_body_ph')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-400 focus:outline-none"
              />
            </div>
            <button
              onClick={() => add.mutate()}
              disabled={!valid || add.isPending}
              className="rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {add.isPending ? t('mkt_adding') : t('mkt_add_step')}
            </button>
          </div>
        )}

        <div className="mt-5 space-y-2">
          {steps.length === 0 && !showForm && (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              {t('mkt_no_steps')}
            </p>
          )}
          {steps.map((s: any, i: any) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-xs font-bold text-slate-600">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{s.subject}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock size={12} />
                  <span>
                    {s.delay_days} {s.delay_days === 1 ? t('mkt_days_after_launch') : t('mkt_days_after_launch_pl')}
                  </span>
                  {s.sent_at && <span className="text-emerald-600">· {t('mkt_sent')}</span>}
                </div>
              </div>
              <button
                onClick={() => remove.mutate(s.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
