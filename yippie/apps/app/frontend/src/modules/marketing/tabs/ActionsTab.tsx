import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { Campaign, CampaignTemplate, marketingApi } from '../api'

interface Stage { id: string; name: string; color: string }

function StageSelect({
  value,
  stages,
  onChange,
}: {
  value: string | null
  stages: Stage[]
  onChange: (id: string | null) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
    >
      <option value="">— No action —</option>
      {stages.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  )
}

function ActionRow({
  label,
  value,
  stages,
  onChange,
  onHover,
}: {
  label: string
  value: string | null
  stages: Stage[]
  onChange: (id: string | null) => void
  onHover?: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 py-2"
      onMouseEnter={onHover}
      onMouseLeave={onHover}
    >
      <span className="w-36 shrink-0 text-sm text-slate-600">{label}</span>
      <span className="text-slate-300 shrink-0">→</span>
      <div className="flex-1">
        <StageSelect value={value} stages={stages} onChange={onChange} />
      </div>
    </div>
  )
}

export function ActionsTab({ campaign }: { campaign: Campaign }) {
  const qc = useQueryClient()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hoveredButtonIdRef = useRef<string | null>(null)

  const [linkedStageId, setLinkedStageId] = useState<string | null>(campaign.linked_stage_id ?? null)
  const [postSendStageId, setPostSendStageId] = useState<string | null>(campaign.post_send_stage_id ?? null)
  const [replyStageId, setReplyStageId] = useState<string | null>(campaign.reply_received_stage_id ?? null)
  const [buttonConfig, setButtonConfig] = useState<Record<string, string>>(campaign.button_stage_config ?? {})

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
  })

  const { data: templates = [] } = useQuery<CampaignTemplate[]>({
    queryKey: ['marketing', 'templates', campaign.id],
    queryFn: () => marketingApi.getTemplates(campaign.id),
  })

  // Parse campaign_buttons from the saved template for the button action rows.
  const campaignButtons: Array<{ id: string; text: string }> = (() => {
    const tpl = templates.find(t => t.variant === 'a') ?? templates[0]
    if (!tpl) return []
    try {
      const raw = (tpl as any).campaign_buttons
      if (!raw) return []
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return Array.isArray(parsed)
        ? parsed.map((b: any) => ({ id: String(b.id ?? ''), text: String(b.text ?? b.label ?? b.id ?? 'Button') })).filter(b => b.id)
        : []
    } catch {
      return []
    }
  })()

  const rawHtml = (() => {
    const tpl = templates.find(t => t.variant === 'a') ?? templates[0]
    return tpl?.raw_html ?? null
  })()

  // Highlight a button element in the iframe preview.
  function highlightButton(buttonId: string | null) {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    // Clear all existing highlights first.
    doc.querySelectorAll('[data-yippie-button]').forEach((el: Element) => {
      ;(el as HTMLElement).style.outline = ''
    })
    if (!buttonId) return
    const el = doc.getElementById(buttonId) as HTMLElement | null
    if (el) el.style.outline = '3px solid #5BA4F5'
  }

  function handleButtonHoverEnter(buttonId: string) {
    hoveredButtonIdRef.current = buttonId
    highlightButton(buttonId)
  }
  function handleButtonHoverLeave() {
    hoveredButtonIdRef.current = null
    highlightButton(null)
  }

  // Re-apply highlight after iframe loads (template may have changed).
  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return
    const handler = () => { if (hoveredButtonIdRef.current) highlightButton(hoveredButtonIdRef.current) }
    frame.addEventListener('load', handler)
    return () => frame.removeEventListener('load', handler)
  }, [])

  const save = useMutation({
    mutationFn: () =>
      marketingApi.updateCampaign(campaign.id, {
        post_send_stage_id: postSendStageId ?? undefined,
        reply_received_stage_id: replyStageId ?? undefined,
        button_stage_config: buttonConfig,
        linked_stage_id: linkedStageId ?? undefined,
      } as any),
    onSuccess: () => {
      toast.success('Actions saved')
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
    },
    onError: () => toast.error('Could not save actions'),
  })

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — action config */}
      <div className="w-96 shrink-0 overflow-y-auto border-r border-slate-200 p-5 space-y-6">

        {/* Campaign settings */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Campaign settings</p>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Linked Kanban stage</p>
              <StageSelect value={linkedStageId} stages={stages} onChange={setLinkedStageId} />
              <p className="mt-1.5 text-[11px] text-slate-400">Links this campaign to a stage for the right-click "Send campaign" option.</p>
            </div>
          </div>
        </div>

        {/* Campaign-level actions */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Campaign actions</p>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            <div className="px-4 py-1">
              <ActionRow
                label="Mail sent"
                value={postSendStageId}
                stages={stages}
                onChange={setPostSendStageId}
              />
            </div>
            <div className="px-4 py-1">
              <ActionRow
                label="Reply received"
                value={replyStageId}
                stages={stages}
                onChange={setReplyStageId}
              />
            </div>
          </div>
        </div>

        {/* Button actions */}
        {campaignButtons.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Button actions</p>
            <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
              {campaignButtons.map(btn => (
                <div
                  key={btn.id}
                  className="px-4 py-1"
                  onMouseEnter={() => handleButtonHoverEnter(btn.id)}
                  onMouseLeave={handleButtonHoverLeave}
                >
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-36 shrink-0 text-sm text-slate-600 truncate" title={btn.text}>{btn.text}</span>
                    <span className="text-slate-300 shrink-0">→</span>
                    <div className="flex-1">
                      <StageSelect
                        value={buttonConfig[btn.id] ?? null}
                        stages={stages}
                        onChange={stageId => {
                          setButtonConfig(prev => {
                            const next = { ...prev }
                            if (stageId) next[btn.id] = stageId
                            else delete next[btn.id]
                            return next
                          })
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {campaignButtons.length === 0 && templates.length > 0 && (
          <p className="text-xs text-slate-400 text-center py-2">No action buttons found in the design. Add buttons in the Design tab.</p>
        )}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {save.isPending ? 'Saving…' : 'Save actions'}
        </button>
      </div>

      {/* Right panel — email preview */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
        {rawHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={rawHtml}
            sandbox="allow-same-origin"
            title="Campaign preview"
            className="flex-1 w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">Save a design first to preview it here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
