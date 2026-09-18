import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { Campaign, CampaignTemplate, marketingApi } from '../api'
import { useT } from '../../../hooks/useT'
import { CloseButton } from '../../../shell/CloseButton'

interface Stage { id: string; name: string; color: string }

// Sentinel select value that opens the "create new stage" popup.
const CREATE_STAGE = '__create_stage__'

function StageSelect({
  value,
  stages,
  noActionLabel,
  onChange,
  onRequestCreate,
}: {
  value: string | null
  stages: Stage[]
  noActionLabel: string
  onChange: (id: string | null) => void
  onRequestCreate: (apply: (id: string | null) => void) => void
}) {
  const t = useT()
  return (
    <select
      value={value ?? ''}
      onChange={e => {
        if (e.target.value === CREATE_STAGE) { onRequestCreate(onChange); return }
        onChange(e.target.value || null)
      }}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
    >
      <option value="">{noActionLabel}</option>
      {stages.map(s => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
      <option value={CREATE_STAGE}>{t('mkt_create_stage_option')}</option>
    </select>
  )
}

// Small popup to create a new Kanban stage without leaving the marketing view.
function NewStageModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (stage: Stage) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#64748b')
  const [error, setError] = useState('')

  const createMut = useMutation({
    mutationFn: (b: object) => api.post('/pipeline/stages', b).then((r: any) => r.data),
    onSuccess: (stage: Stage) => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages'] })
      qc.invalidateQueries({ queryKey: ['pipeline-board'] })
      onCreated(stage)
      onClose()
    },
    onError: () => setError(t('mkt_stage_create_err')),
  })

  function handleCreate() {
    if (!name.trim()) { setError(t('mkt_stage_name_required')); return }
    createMut.mutate({ name: name.trim(), color })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">{t('mkt_new_stage_title')}</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              placeholder={t('mkt_stage_name_ph')}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
            />
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
              title={t('mkt_stage_color_title')}
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={createMut.isPending}
            className="w-full rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {createMut.isPending ? t('mkt_creating_stage') : t('mkt_create_stage_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionRow({
  label,
  value,
  stages,
  noActionLabel,
  onChange,
  onRequestCreate,
  onHover,
}: {
  label: string
  value: string | null
  stages: Stage[]
  noActionLabel: string
  onChange: (id: string | null) => void
  onRequestCreate: (apply: (id: string | null) => void) => void
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
        <StageSelect value={value} stages={stages} noActionLabel={noActionLabel} onChange={onChange} onRequestCreate={onRequestCreate} />
      </div>
    </div>
  )
}

export function ActionsTab({ campaign }: { campaign: Campaign }) {
  const t = useT()
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

  // "Create new stage" popup — the pending ref remembers which dropdown asked,
  // so the freshly created stage is selected back into that same field.
  const [showCreateStage, setShowCreateStage] = useState(false)
  const pendingApplyRef = useRef<((id: string | null) => void) | null>(null)
  function requestCreateStage(apply: (id: string | null) => void) {
    pendingApplyRef.current = apply
    setShowCreateStage(true)
  }

  const { data: templates = [] } = useQuery<CampaignTemplate[]>({
    queryKey: ['marketing', 'templates', campaign.id],
    queryFn: () => marketingApi.getTemplates(campaign.id),
  })

  // Parse campaign_buttons from the saved template for the button action rows.
  const campaignButtons: Array<{ id: string; text: string }> = (() => {
    const tpl = templates.find((t: CampaignTemplate) => t.variant === 'a') ?? templates[0]
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
    const tpl = templates.find((t: CampaignTemplate) => t.variant === 'a') ?? templates[0]
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
    const el = doc.querySelector(`[data-yippie-button][id="${buttonId}"], [data-yippie-button="${buttonId}"]`) as HTMLElement | null
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
        post_send_stage_id: postSendStageId,
        reply_received_stage_id: replyStageId,
        button_stage_config: buttonConfig,
        linked_stage_id: linkedStageId,
      } as any),
    onSuccess: () => {
      toast.success(t('mkt_actions_saved'))
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] })
    },
    onError: (err: any) => {
      // Surface the real cause so we can diagnose the "fails the first time"
      // report without needing the browser Network tab.
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: any) => d?.msg).filter(Boolean).join(', ')
        : ''
      // eslint-disable-next-line no-console
      console.error('[marketing actions save failed]', status, err?.response?.data ?? err)
      toast.error(
        `${t('mkt_actions_save_err')}${status ? ` (${status})` : ''}${msg ? `: ${msg}` : ''}`,
      )
    },
  })

  const noActionLabel = t('mkt_no_action')

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — action config */}
      <div className="w-96 shrink-0 overflow-y-auto border-r border-slate-200 p-5 space-y-6">

        {/* Campaign settings */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{t('mkt_campaign_settings')}</p>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-slate-500 mb-1.5">{t('mkt_linked_kanban_stage')}</p>
              <StageSelect value={linkedStageId} stages={stages} noActionLabel={noActionLabel} onChange={setLinkedStageId} onRequestCreate={requestCreateStage} />
              <p className="mt-1.5 text-[11px] text-slate-400">{t('mkt_linked_stage_desc')}</p>
            </div>
          </div>
        </div>

        {/* Campaign-level actions */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{t('mkt_campaign_actions')}</p>
          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            <div className="px-4 py-1">
              <ActionRow
                label={t('mkt_mail_sent')}
                value={postSendStageId}
                stages={stages}
                noActionLabel={noActionLabel}
                onChange={setPostSendStageId}
                onRequestCreate={requestCreateStage}
              />
            </div>
            <div className="px-4 py-1">
              <ActionRow
                label={t('mkt_reply_received')}
                value={replyStageId}
                stages={stages}
                noActionLabel={noActionLabel}
                onChange={setReplyStageId}
                onRequestCreate={requestCreateStage}
              />
            </div>
          </div>
        </div>

        {/* Button actions */}
        {campaignButtons.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{t('mkt_button_actions')}</p>
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
                        noActionLabel={noActionLabel}
                        onRequestCreate={requestCreateStage}
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
          <p className="text-xs text-slate-400 text-center py-2">{t('mkt_no_buttons_desc')}</p>
        )}

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full rounded-xl bg-yippie px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {save.isPending ? t('mkt_saving_actions') : t('mkt_save_actions')}
        </button>
      </div>

      {/* Right panel — email preview */}
      <div className="flex-1 min-w-0 flex flex-col bg-slate-50">
        {rawHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={rawHtml}
            sandbox="allow-same-origin"
            title={t('mkt_campaign_preview')}
            className="flex-1 w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-slate-400">{t('mkt_save_design_first')}</p>
          </div>
        )}
      </div>

      {showCreateStage && (
        <NewStageModal
          onClose={() => setShowCreateStage(false)}
          onCreated={stage => { pendingApplyRef.current?.(stage.id); pendingApplyRef.current = null }}
        />
      )}
    </div>
  )
}
