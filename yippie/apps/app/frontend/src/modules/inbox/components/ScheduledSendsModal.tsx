import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Trash2 } from 'lucide-react'
import { CloseButton } from '../../../shell/CloseButton'
import { api } from '../../../api/client'
import { fmtDateTime } from '../../../lib/format'
import { useT } from '../../../hooks/useT'

export interface ScheduledSend {
  compose_id: string
  subject: string
  send_at: string
  from_email: string | null
  recipients: string[]
}

export default function ScheduledSendsModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const qc = useQueryClient()

  const { data: items = [], isLoading } = useQuery<ScheduledSend[]>({
    queryKey: ['inbox-scheduled'],
    queryFn: () => api.get<ScheduledSend[]>('/inbox/scheduled').then((r: any) => r.data),
  })

  const cancel = useMutation({
    mutationFn: (composeId: string) => api.delete(`/inbox/scheduled/${composeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox-scheduled'] }),
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock size={16} className="text-slate-400" />
            {t('inbox_scheduled_title')}
          </h2>
          <CloseButton onClick={onClose} />
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading ? (
            <div className="px-4 py-8 text-sm text-slate-400 text-center">{t('inbox_scheduled_loading')}</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-sm text-slate-400 text-center">{t('inbox_scheduled_empty')}</div>
          ) : (
            items.map(item => (
              <div key={item.compose_id} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.subject || t('inbox_scheduled_no_subject')}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {item.recipients.length === 1
                      ? item.recipients[0]
                      : t('inbox_scheduled_n_recipients').replace('{n}', String(item.recipients.length))}
                  </p>
                  <p className="text-xs text-blue-600 font-medium mt-0.5">
                    {t('inbox_scheduled_for')} {fmtDateTime(item.send_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => cancel.mutate(item.compose_id)}
                  disabled={cancel.isPending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-danger-600 bg-danger-50 border border-danger-200 rounded-lg hover:bg-danger-100 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Trash2 size={12} />
                  {t('inbox_scheduled_cancel')}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            {t('booking_btn_cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
