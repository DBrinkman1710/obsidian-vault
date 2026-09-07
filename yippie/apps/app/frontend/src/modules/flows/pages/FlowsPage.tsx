import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Check, ChevronDown, ChevronRight, Copy, FlaskConical, GitBranch, MoreVertical, Pencil, Plus,
  RefreshCw, Settings2, ShieldCheck, Sparkles, Trash2, Workflow, X, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useContextMenu, ContextMenu } from '../../../components/ContextMenu'
import { useCopy } from '../../../hooks/useCopy'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { useTenantConfig } from '../../../App'
import { useT } from '../../../hooks/useT'
// [FLOW4] branched flows store a graph; the modal only edits the linear shape.
// Types + shared helpers live in ../lib (single source, also used by the canvas).
import {
  Action, Builtin, Condition, Flow, FlowRun, FlowsMeta, MetaField, MetaOption,
  OP_LABELS, RUN_BADGE, WAIT_UNITS, WEEKDAYS,
  actionLabel, actionNodes, apiError, groupTriggers, isGraph, toGroups, triggerLabel,
} from '../lib'
import { CloseButton } from '../../../shell/CloseButton'

interface TestFireResult {
  trigger_type: string
  sample_event: Record<string, any>
  matched: boolean
  actions: {
    type: string; label: string; detail: string
    would_run: boolean; reason: string | null
  }[]
}
interface Recipe {
  key: string
  name: string
  description: string
  trigger_type: string
  conditions: Condition[]
  actions: Action[]
}

// [KAN_FLOW2] Prefill delivered via router state when arriving from a pipeline
// flowchart automation suggestion ("Create in Flows"). Seeds a NEW flow's
// builder — never targets an existing flow, so save always POSTs a fresh flow.
export interface FlowPrefill {
  name?: string
  trigger_type?: string
  trigger_config?: Record<string, any>
  conditions?: Condition[] | Condition[][]
  actions?: Action[]
}

const RUN_STATUS_FILTERS = ['success', 'partial', 'failed', 'waiting', 'skipped']

function flowSummary(meta: FlowsMeta | undefined, flow: Flow): string {
  const when = `When ${triggerLabel(meta, flow.trigger_type).toLowerCase()}`
  const groups = toGroups(flow.conditions)
  const count = groups.reduce((n, g) => n + g.length, 0)
  const ifPart = count
    ? `, if ${count} condition${count !== 1 ? 's' : ''} match`
    : ''
  const acts = actionNodes(flow.actions)
  const branched = isGraph(flow.actions)
  const thenPart = acts.length
    ? ` → ${acts.map(a => actionLabel(meta, a.type).toLowerCase()).join(', ')}${branched ? ' (branching)' : ''}`
    : ' → (no actions yet)'
  return when + ifPart + thenPart
}

/* ---------------------------------------------------------------- builder */

function OptionSelect({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: MetaOption[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  )
}

function ConfigField({
  field, value, meta, onChange,
}: { field: MetaField; value: any; meta: FlowsMeta; onChange: (v: any) => void }) {
  const base = 'px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
  if (field.type === 'select') {
    return (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={`${base} bg-white`}>
        <option value="">{field.label}…</option>
        {(field.options ?? []).map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
      </select>
    )
  }
  if (field.type === 'user_select') {
    return <OptionSelect value={value ?? ''} onChange={onChange} options={meta.users} placeholder={`${field.label}…`} />
  }
  if (field.type === 'stage_select') {
    return <OptionSelect value={value ?? ''} onChange={onChange} options={meta.stages} placeholder={`${field.label}…`} />
  }
  if (field.type === 'template_select') {
    return <OptionSelect value={value ?? ''} onChange={onChange} options={meta.templates} placeholder={`${field.label}…`} />
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.label}
        rows={2}
        className={`${base} w-full resize-y`}
      />
    )
  }
  return (
    <input
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={field.label}
      className={`${base} w-full`}
    />
  )
}

function WaitConfig({
  config, onChange,
}: { config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  const t = useT()
  const unit = WAIT_UNITS.find(u => u in config) ?? 'hours'
  const amount = config[unit] ?? ''
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-slate-600">{t('flow_wait_for')}</span>
      <input
        type="number"
        min={1}
        value={amount}
        onChange={e => onChange(e.target.value === '' ? {} : { [unit]: Number(e.target.value) })}
        placeholder="0"
        className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <select
        value={unit}
        onChange={e => onChange(amount === '' ? {} : { [e.target.value]: Number(amount) })}
        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {WAIT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <span className="text-sm text-slate-500">{t('flow_before_next_step')}</span>
    </div>
  )
}

// [FLOW5] The inbound URL + outbound signing secret for a webhook-trigger flow.
// Only meaningful once the flow exists (the token is minted on save).
function WebhookPanel({ flowId }: { flowId: string | undefined }) {
  const t = useT()
  const qc = useQueryClient()
  const { copy: copyText } = useCopy()
  const { data, isLoading } = useQuery<{ inbound_url: string; signing_secret: string }>({
    queryKey: ['flow-webhook', flowId],
    queryFn: () => api.get(`/flows/${flowId}/webhook`).then((r: any) => r.data),
    enabled: !!flowId,
  })
  const rotateToken = useMutation({
    mutationFn: () => api.post(`/flows/${flowId}/webhook/rotate`).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flow-webhook', flowId] }); toast.success(t('flow_new_inbound_url_msg')) },
    onError: (err: any) => toast.error(apiError(err)),
  })
  const rotateSecret = useMutation({
    mutationFn: () => api.post('/flows/webhook_secret/rotate').then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flow-webhook', flowId] }); toast.success(t('flow_new_secret_msg')) },
    onError: (err: any) => toast.error(apiError(err)),
  })
  const copy = (text: string, label: string) => {
    copyText(text, `${label} copied`)
  }
  if (!flowId) {
    return (
      <p className="text-xs text-slate-400 pt-1">
        {t('flow_webhook_save_first')}
      </p>
    )
  }
  return (
    <div className="pt-1 space-y-2">
      {isLoading && <p className="text-xs text-slate-400">{t('flow_webhook_loading')}</p>}
      {data && (
        <>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-1">{t('flow_inbound_url_label')}</p>
            <div className="flex items-center gap-1.5">
              <input readOnly value={data.inbound_url} className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 text-slate-600 focus:outline-none" />
              <button onClick={() => copy(data.inbound_url, 'URL')} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title={t('flow_copy_url')}><Copy size={13} /></button>
              <button onClick={() => rotateToken.mutate()} disabled={rotateToken.isPending} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-50" title={t('flow_regen_url')}><RefreshCw size={13} /></button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{t('flow_inbound_url_tip')}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 mb-1">{t('flow_signing_secret_label')}</p>
            <div className="flex items-center gap-1.5">
              <input readOnly value={data.signing_secret} className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-slate-50 text-slate-600 focus:outline-none" />
              <button onClick={() => copy(data.signing_secret, 'Secret')} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title={t('flow_copy_secret')}><Copy size={13} /></button>
              <button onClick={() => { if (confirm(t('flow_rotate_confirm'))) rotateSecret.mutate() }} disabled={rotateSecret.isPending} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-50" title={t('flow_rotate_secret')}><RefreshCw size={13} /></button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{t('flow_signing_tip')} <span className="font-mono">X-Yippie-Signature: sha256=…</span></p>
          </div>
        </>
      )}
    </div>
  )
}

function BuilderModal({
  meta, flow, prefill, onClose, onSaved,
}: {
  meta: FlowsMeta
  flow: Flow | null
  // [KAN_FLOW2] Seed values for a BRAND NEW flow (flow === null) — e.g. a
  // pipeline flowchart automation suggestion opening the builder prefilled.
  prefill?: FlowPrefill | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  // For a new flow, fall back to the prefill's seed values.
  const seed = flow ?? prefill ?? null
  const [name, setName] = useState(seed?.name ?? '')
  const [triggerType, setTriggerType] = useState(seed?.trigger_type ?? meta.triggers[0]?.key ?? '')
  const [groups, setGroups] = useState<Condition[][]>(toGroups(seed?.conditions ?? []))
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>(
    seed?.trigger_config && Object.keys(seed.trigger_config).length
      ? seed.trigger_config
      : { frequency: 'daily', time: '09:00' }
  )
  // [FLOW6] per-flow opt-in: may flow-caused events trigger this flow?
  const [chainable, setChainable] = useState(!!seed?.trigger_config?.chainable)
  // [FLOW4] a branched flow's graph can't be edited here — openEdit routes those
  // to the canvas; this fallback guards direct paths (duplicate, install).
  const branched = flow ? isGraph(flow.actions) : false
  const [actions, setActions] = useState<Action[]>(
    flow && !isGraph(flow.actions) ? flow.actions
      : prefill?.actions ? prefill.actions
      : []
  )
  const [enabled, setEnabled] = useState(flow?.enabled ?? true)
  const [error, setError] = useState('')

  const trigger = meta.triggers.find(t => t.key === triggerType)

  const saveMut = useMutation({
    mutationFn: (body: object) =>
      flow ? api.patch(`/flows/${flow.id}`, body) : api.post('/flows', body),
    onSuccess: () => { onSaved(); onClose() },
    onError: (err: any) => setError(apiError(err)),
  })

  function handleSave() {
    if (!name.trim()) { setError(t('flow_name_required')); return }
    setError('')
    const conditions = groups
      .map(g => g
        .filter(c => c.field && c.op)
        .map(c => ({
          ...c,
          value: c.op === 'in' && typeof c.value === 'string'
            ? c.value.split(',').map(v => v.trim()).filter(Boolean)
            : c.value,
        })))
      .filter(g => g.length > 0)  // drop empty groups (backend rejects them)
    const body = {
      name: name.trim(),
      trigger_type: triggerType,
      trigger_config: {
        ...(triggerType === 'schedule' ? triggerConfig : {}),
        ...(chainable ? { chainable: true } : {}),
      },
      conditions,
      actions,
      enabled,
    }
    saveMut.mutate(body)
  }

  function setCondition(gi: number, ci: number, patch: Partial<Condition>) {
    setGroups(gs => gs.map((g, gIdx) =>
      gIdx === gi ? g.map((c, cIdx) => (cIdx === ci ? { ...c, ...patch } : c)) : g))
  }
  function addCondition(gi: number) {
    setGroups(gs => gs.map((g, gIdx) =>
      gIdx === gi ? [...g, { field: '', op: 'equals', value: '' }] : g))
  }
  function removeCondition(gi: number, ci: number) {
    setGroups(gs => gs
      .map((g, gIdx) => (gIdx === gi ? g.filter((_, cIdx) => cIdx !== ci) : g))
      .filter(g => g.length > 0))
  }
  function addGroup() {
    setGroups(gs => [...gs, [{ field: '', op: 'equals', value: '' }]])
  }
  function setActionConfig(i: number, key: string, value: any) {
    setActions(as => as.map((a, idx) => (idx === i ? { ...a, config: { ...a.config, [key]: value } } : a)))
  }
  function setWholeConfig(i: number, config: Record<string, any>) {
    setActions(as => as.map((a, idx) => (idx === i ? { ...a, config } : a)))
  }

  function conditionValueInput(c: Condition, gi: number, ci: number) {
    const fieldMeta = trigger?.fields.find(f => f.key === c.field)
    if (c.op === 'in') {
      const display = Array.isArray(c.value) ? c.value.join(', ') : (c.value ?? '')
      return (
        <input
          value={display}
          onChange={e => setCondition(gi, ci, { value: e.target.value })}
          placeholder="value1, value2, …"
          className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      )
    }
    if (fieldMeta?.type === 'select') {
      return (
        <select
          value={c.value ?? ''}
          onChange={e => setCondition(gi, ci, { value: e.target.value })}
          className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">value…</option>
          {(fieldMeta.options ?? []).map(o => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
        </select>
      )
    }
    if (fieldMeta?.type === 'stage_select') {
      return (
        <div className="flex-1">
          <OptionSelect
            value={c.value ?? ''}
            onChange={v => setCondition(gi, ci, { value: v })}
            options={meta.stages}
            placeholder="stage…"
          />
        </div>
      )
    }
    return (
      <input
        value={c.value ?? ''}
        onChange={e => setCondition(gi, ci, { value: e.target.value })}
        placeholder="value"
        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    )
  }

  if (branched && flow) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto py-10 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <Zap size={16} className="text-slate-400" />
            <h2 className="text-base font-semibold text-slate-900">{t('flow_edit_flow')}</h2>
            <CloseButton onClick={onClose} className="ml-auto" />
          </div>
          <div className="px-6 py-10 text-center space-y-3">
            <GitBranch size={24} className="mx-auto text-violet-400" />
            <p className="text-sm text-slate-600">
              {t('flow_branched_desc')}
            </p>
            <Link
              to={`/flows/${flow.id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-lg hover:opacity-90"
            >
              <Workflow size={14} /> {t('flow_open_canvas_btn')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Zap size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">{flow ? t('flow_edit_flow') : t('flow_new_flow_title')}</h2>
          <CloseButton onClick={onClose} className="ml-auto" />
        </div>

        <div className="px-6 py-5 space-y-6">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('flow_flow_name_ph')}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* When */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('flow_when_label')}</p>
            <select
              value={triggerType}
              onChange={e => { setTriggerType(e.target.value); setGroups([]) }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {groupTriggers(meta.triggers).map(([group, triggers]) => (
                <optgroup key={group} label={group}>
                  {triggers.map(trig => <option key={trig.key} value={trig.key}>{trig.label}</option>)}
                </optgroup>
              ))}
            </select>
            {triggerType === 'schedule' && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <select
                  value={triggerConfig.frequency ?? 'daily'}
                  onChange={e => {
                    const frequency = e.target.value
                    setTriggerConfig(c => frequency === 'weekly'
                      ? { ...c, frequency, weekday: c.weekday ?? 0 }
                      : { frequency, time: c.time ?? '09:00' })
                  }}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="daily">{t('flow_every_day')}</option>
                  <option value="weekly">{t('flow_every_week')}</option>
                </select>
                {triggerConfig.frequency === 'weekly' && (
                  <select
                    value={String(triggerConfig.weekday ?? 0)}
                    onChange={e => setTriggerConfig(c => ({ ...c, weekday: Number(e.target.value) }))}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                )}
                <span className="text-sm text-slate-500">{t('flow_at')}</span>
                <input
                  type="time"
                  value={triggerConfig.time ?? '09:00'}
                  onChange={e => setTriggerConfig(c => ({ ...c, time: e.target.value }))}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            )}
            {triggerType === 'webhook' && <WebhookPanel flowId={flow?.id} />}
            {/* [FLOW6] schedule/webhook events are never flow-caused, so the
                opt-in only makes sense for mutation triggers */}
            {triggerType !== 'schedule' && triggerType !== 'webhook' && (
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={chainable}
                  onChange={e => setChainable(e.target.checked)}
                  className="accent-blue-600"
                />
                {t('flow_chainable_label')}
              </label>
            )}
          </div>

          {/* If */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {t('flow_if_label')} {groups.length > 1 ? t('flow_if_any_group') : t('flow_if_all_match')}
            </p>
            {groups.length === 0 && (
              <p className="text-xs text-slate-400">{t('flow_no_conditions')}</p>
            )}
            {groups.map((group, gi) => (
              <div key={gi}>
                {gi > 0 && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{t('flow_or')}</span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}
                <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                  {group.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      {trigger?.free_fields ? (
                        <input
                          value={c.field}
                          onChange={e => setCondition(gi, ci, { field: e.target.value })}
                          placeholder="payload field…"
                          className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      ) : (
                        <select
                          value={c.field}
                          onChange={e => setCondition(gi, ci, { field: e.target.value, value: '' })}
                          className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="">field…</option>
                          {(trigger?.fields ?? []).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                      )}
                      <select
                        value={c.op}
                        onChange={e => setCondition(gi, ci, { op: e.target.value })}
                        className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {Object.entries(OP_LABELS).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
                      </select>
                      {conditionValueInput(c, gi, ci)}
                      <button
                        onClick={() => removeCondition(gi, ci)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        title={t('flow_remove_condition')}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addCondition(gi)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    <Plus size={13} /> {t('flow_add_condition')}
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={addGroup}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus size={13} /> {groups.length === 0 ? t('flow_add_condition') : t('flow_add_or_group')}
            </button>
          </div>

          {/* Then */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('flow_then_label')}</p>
            {actions.map((a, i) => {
              const actionMeta = meta.actions.find(m => m.key === a.type)
              return (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <select
                      value={a.type}
                      onChange={e => setActions(as => as.map((x, idx) => (idx === i ? { type: e.target.value, config: {} } : x)))}
                      className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      {meta.actions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <button
                      onClick={() => setActions(as => as.filter((_, idx) => idx !== i))}
                      className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      title={t('flow_delete_action')}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {a.type === 'wait' ? (
                    <WaitConfig config={a.config} onChange={c => setWholeConfig(i, c)} />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {(actionMeta?.config_fields ?? []).map(f => (
                        <div key={f.key} className={f.type === 'textarea' ? 'col-span-2' : ''}>
                          <ConfigField
                            field={f}
                            value={a.config[f.key]}
                            meta={meta}
                            onChange={v => setActionConfig(i, f.key, v)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            <button
              onClick={() => setActions(as => [...as, { type: meta.actions[0]?.key ?? 'notify_user', config: {} }])}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus size={13} /> {t('flow_add_action')}
            </button>
            <p className="text-xs text-slate-400">
              {t('flow_tip_placeholders')}
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="accent-blue-600" />
            {t('flow_enabled_label')}
          </label>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {t('flow_cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {flow ? t('flow_save_flow') : t('flow_create_flow')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- run drawer */

function RunsDrawer({ flowId }: { flowId: string }) {
  const t = useT()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data: runs = [], isLoading } = useQuery<FlowRun[]>({
    queryKey: ['flow-runs', flowId, statusFilter],
    queryFn: () => api
      .get(`/flows/${flowId}/runs`, { params: statusFilter ? { status: statusFilter } : {} })
      .then((r: any) => r.data),
  })
  return (
    <div className="border-t border-slate-100 bg-slate-50/50">
      <div className="flex items-center gap-1.5 px-6 py-2 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mr-1">{t('flow_filter_label')}</span>
        {['', ...RUN_STATUS_FILTERS].map(s => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize transition-colors ${
              statusFilter === s
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {s || t('filter_all')}
          </button>
        ))}
      </div>
      {isLoading && <p className="px-6 pb-4 text-xs text-slate-400">{t('flow_loading_runs')}</p>}
      {!isLoading && runs.length === 0 && (
        <p className="px-6 pb-4 text-xs text-slate-400">
          {statusFilter ? t('flow_no_runs_filtered').replace('{status}', statusFilter) : t('flow_no_runs_yet')}
        </p>
      )}
      <div className="divide-y divide-slate-50">
      {runs.map(run => (
        <div key={run.id} className="px-6 py-2.5 flex items-start gap-3 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-semibold shrink-0 ${RUN_BADGE[run.status] ?? RUN_BADGE.skipped}`}>
            {run.status}
          </span>
          <div className="flex-1 min-w-0 space-y-0.5">
            {run.results.length === 0 && <p className="text-slate-400">{t('flow_conditions_no_match')}</p>}
            {run.results.map((r, i) => (
              <p
                key={i}
                className={r.pending_retry ? 'text-amber-600' : r.ok ? 'text-slate-600' : 'text-slate-400'}
              >
                {r.summary}
                {typeof r.attempts === 'number' && r.attempts > 1 ? ` (${t('flow_attempt')} ${r.attempts})` : ''}
              </p>
            ))}
            {run.error && <p className="text-red-500 truncate">{run.error}</p>}
          </div>
          <span className="text-slate-400 shrink-0">{new Date(run.created_at).toLocaleString()}</span>
        </div>
      ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- test fire */

function TestFireModal({
  meta, flow, onClose,
}: { meta: FlowsMeta; flow: Flow; onClose: () => void }) {
  const t = useT()
  const { data, isLoading, isError } = useQuery<TestFireResult>({
    queryKey: ['flow-test', flow.id],
    queryFn: () => api.post(`/flows/${flow.id}/test`).then((r: any) => r.data),
  })
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto py-10 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <FlaskConical size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">{t('flow_test_fire_title')} — {flow.name}</h2>
          <CloseButton onClick={onClose} className="ml-auto" />
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-slate-500">
            {t('flow_test_fire_desc')}
          </p>
          {isLoading && <p className="text-sm text-slate-400">{t('flow_running')}</p>}
          {isError && <p className="text-sm text-red-500">{t('flow_test_run_err')}</p>}
          {data && (
            <>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  {t('flow_sample_label')} {triggerLabel(meta, data.trigger_type).toLowerCase()}
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-0.5">
                  {Object.keys(data.sample_event).length === 0 && (
                    <p className="text-slate-400">{t('flow_no_fields_trigger')}</p>
                  )}
                  {Object.entries(data.sample_event).map(([k, v]) => (
                    <p key={k} className="text-slate-600">
                      <span className="text-slate-400">{k}:</span> {String(v)}
                    </p>
                  ))}
                </div>
              </div>
              <div className={`flex items-center gap-2 text-sm font-semibold ${data.matched ? 'text-emerald-600' : 'text-amber-600'}`}>
                {data.matched
                  ? <><Check size={15} /> {t('flow_conditions_match')}</>
                  : <><X size={15} /> {t('flow_conditions_no_match2')}</>}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  {t('flow_then_label')} {data.matched ? t('flow_then_actions_run') : t('flow_then_nothing_runs')}
                </p>
                {data.actions.length === 0 && <p className="text-xs text-slate-400">{t('flow_no_actions_configured')}</p>}
                <div className="space-y-1.5">
                  {data.actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 shrink-0 ${a.would_run ? 'text-emerald-500' : 'text-slate-300'}`}>
                        {a.would_run ? <Check size={14} /> : <X size={14} />}
                      </span>
                      <div className="min-w-0">
                        <p className={a.would_run ? 'text-slate-700' : 'text-slate-400'}>{a.detail}</p>
                        {a.reason && <p className="text-xs text-slate-400">{t('flow_skipped')} {a.reason}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="ml-auto px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            {t('flow_close')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------ [FLOW8] platform automations */

// Read-only grid of the always-on automations Yippie runs for the tenant. Shown
// to admins AND members — it's informational, nothing here is editable.
function PlatformAutomations({ builtins }: { builtins: Builtin[] }) {
  const t = useT()
  if (!builtins || builtins.length === 0) return null
  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={15} className="text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900">{t('flow_platform_automations')}</h2>
      </div>
      <p className="text-sm text-slate-500 mb-3">{t('flow_platform_desc')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {builtins.map(b => (
          <div key={b.key} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">{b.name}</p>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {b.cadence}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex-1">{b.description}</p>
            {b.settings_path && (
              <Link
                to={b.settings_path}
                className="mt-3 self-start inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                <Settings2 size={12} /> {t('flow_configure')}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- page */

export default function FlowsPage() {
  const t = useT()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const config = useTenantConfig()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  // [FLOW9] plan cap on ENABLED, non default flows (null == unlimited). The
  // backend enforces it on enable; this is the visible counter + hint.
  const flowLimit = config?.plan_limits?.flows ?? null
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)
  const [builderPrefill, setBuilderPrefill] = useState<FlowPrefill | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const location = useLocation()

  // [KAN_FLOW2] A pipeline flowchart suggestion deep-links here with a prefill in
  // router state. Open the builder seeded with it, then clear the state so a
  // refresh/back doesn't re-open it.
  useEffect(() => {
    const prefill = (location.state as any)?.flowPrefill as FlowPrefill | undefined
    if (prefill && isAdmin) {
      setEditingFlow(null)
      setBuilderPrefill(prefill)
      setBuilderOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.state]) // eslint-disable-line react-hooks/exhaustive-deps
  const [testingFlow, setTestingFlow] = useState<Flow | null>(null)

  const { data: meta } = useQuery<FlowsMeta>({
    queryKey: ['flows-meta'],
    queryFn: () => api.get('/flows/meta').then((r: any) => r.data),
  })
  const { data: flows = [], isLoading } = useQuery<Flow[]>({
    queryKey: ['flows'],
    queryFn: () => api.get('/flows').then((r: any) => r.data),
  })
  const { data: recipes = [] } = useQuery<Recipe[]>({
    queryKey: ['flow-recipes'],
    queryFn: () => api.get('/flows/recipes').then((r: any) => r.data),
    enabled: isAdmin,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['flows'] })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/flows/${id}`, { enabled }),
    onSuccess: invalidate,
    onError: (err: any) => toast.error(apiError(err)),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/flows/${id}`),
    onSuccess: invalidate,
  })
  const duplicateMut = useMutation({
    mutationFn: (id: string) => api.post(`/flows/${id}/duplicate`).then((r: any) => r.data),
    onSuccess: (flow: Flow) => {
      invalidate()
      toast.success(t('flow_duplicated_msg'))
      // [FLOW4] a branched copy is edited on the canvas, not the modal
      if (isGraph(flow.actions)) {
        navigate(`/flows/${flow.id}`)
        return
      }
      setEditingFlow(flow)
      setBuilderOpen(true)
    },
    onError: (err: any) => toast.error(apiError(err)),
  })
  const installMut = useMutation({
    mutationFn: (key: string) => api.post(`/flows/recipes/${key}/install`).then((r: any) => r.data),
    onSuccess: (flow: Flow) => {
      invalidate()
      setEditingFlow(flow)
      setBuilderOpen(true)
      toast.success(t('flow_recipe_installed'))
    },
  })
  const newCanvasMut = useMutation({
    mutationFn: () => api.post('/flows', {
      name: 'Untitled flow',
      trigger_type: meta!.triggers[0].key,
      actions: [],
      enabled: false,
    }).then((r: any) => r.data),
    onSuccess: (flow: Flow) => { invalidate(); navigate(`/flows/${flow.id}`) },
    onError: (err: any) => toast.error(apiError(err)),
  })

  function openEdit(flow: Flow) {
    // [FLOW4] the modal only edits linear flows — branched ones live on the canvas
    if (isGraph(flow.actions)) {
      navigate(`/flows/${flow.id}`)
      return
    }
    setEditingFlow(flow)
    setBuilderOpen(true)
  }
  function openNew() { setEditingFlow(null); setBuilderPrefill(null); setBuilderOpen(true) }

  const ctx = useContextMenu()

  function rowMenuItems(flow: Flow) {
    return [
      { label: t('flow_open_canvas'), icon: <Workflow size={13} />, onClick: () => navigate(`/flows/${flow.id}`) },
      ...(isAdmin ? [
        { label: t('flow_test_fire'), icon: <FlaskConical size={13} />, onClick: () => setTestingFlow(flow) },
        ...(!flow.is_default ? [{ label: t('flow_edit'), icon: <Pencil size={13} />, onClick: () => openEdit(flow) }] : []),
        { label: t('flow_duplicate'), icon: <Copy size={13} />, onClick: () => duplicateMut.mutate(flow.id) },
        { separator: true as const },
        { label: t('flow_delete'), icon: <Trash2 size={13} />, danger: true, onClick: () => { if (confirm(`${t('flow_delete')} "${flow.name}"?`)) deleteMut.mutate(flow.id) } },
      ] : []),
    ]
  }

  // [FLOW9] enabled, non default flows count against the plan cap
  const activeCount = flows.filter(f => f.enabled && !f.is_default).length
  const atCap = flowLimit != null && activeCount >= flowLimit

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="heading-xl text-slate-900">{t('flow_flows')}</h1>
          <p className="text-sm text-slate-500">{t('flow_page_desc')}</p>
        </div>
        {isAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => newCanvasMut.mutate()}
              disabled={!meta || newCanvasMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              <Workflow size={14} /> {t('flow_new_on_canvas')}
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-1.5 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-lg hover:opacity-90"
            >
              <Plus size={14} /> {t('flow_new_flow')}
            </button>
          </div>
        )}
      </div>

      {/* Recipes */}
      {isAdmin && recipes.length > 0 && (
        <div className="mb-8" data-recipes-section>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Sparkles size={12} /> {t('flow_ready_made_recipes')}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recipes.map(r => (
              <div key={r.key} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col">
                <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500 mt-1 flex-1">{r.description}</p>
                <button
                  onClick={() => installMut.mutate(r.key)}
                  disabled={installMut.isPending}
                  className="mt-3 self-start text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {t('flow_install_recipe')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flow list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-100">
          <Zap size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">{t('flow_your_flows')}</h2>
          <span className="ml-auto text-xs text-slate-400">
            {flowLimit != null
              ? `${activeCount} ${t('flow_active_of')} ${flowLimit} ${t('flow_active')}`
              : `${flows.length} ${flows.length !== 1 ? t('flow_flows_plural') : t('flow_flow')}`}
          </span>
        </div>
        {atCap && isAdmin && (
          <p className="px-6 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
            {t('flow_at_cap').replace('{limit}', String(flowLimit))}{' '}
            <Link to="/settings/subscription" className="font-semibold underline">{t('flow_at_cap_upgrade')}</Link>{' '}
            {t('flow_at_cap_suffix')}
          </p>
        )}

        {isLoading && <p className="px-6 py-8 text-sm text-slate-400 text-center">{t('flow_loading')}</p>}
        {!isLoading && flows.length === 0 && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-slate-400 mb-4">
              {isAdmin ? t('flow_no_flows_admin') : t('flow_no_flows_member')}
            </p>
            {isAdmin && (
              <div className="flex items-center justify-center gap-2">
                {recipes.length > 0 && (
                  <button
                    onClick={() => document.querySelector<HTMLElement>('[data-recipes-section]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <Sparkles size={14} /> {t('flow_browse_recipes')}
                  </button>
                )}
                <button
                  onClick={openNew}
                  className="flex items-center gap-1.5 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Plus size={14} /> {t('flow_new_flow')}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {flows.map(flow => (
            <div key={flow.id}>
              <div className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50">
                <button
                  onClick={() => setExpandedId(expandedId === flow.id ? null : flow.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
                  title={t('flow_show_recent_runs')}
                >
                  {expandedId === flow.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {flow.name}
                    {flow.is_default && (
                      <span
                        className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"
                        title={t('flow_default_title')}
                      >
                        {t('flow_default_badge')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{flowSummary(meta, flow)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs" title={`${flow.run_count} total ${flow.run_count !== 1 ? t('flow_runs') : t('flow_run')}`}>
                  {flow.success_count > 0 && (
                    <span className="text-emerald-600 font-semibold">{flow.success_count}</span>
                  )}
                  {flow.fail_count > 0 && (
                    <span className="text-red-500 font-semibold">{flow.fail_count}</span>
                  )}
                  {flow.success_count === 0 && flow.fail_count === 0 && (
                    <span className="text-slate-400">{flow.run_count} {flow.run_count !== 1 ? t('flow_runs') : t('flow_run')}</span>
                  )}
                </div>
                {/* Row controls kept minimal: enable/disable + everything else behind the 3-dot menu */}
                {isAdmin && (
                  <button
                    onClick={() => toggleMut.mutate({ id: flow.id, enabled: !flow.enabled })}
                    className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${flow.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    title={flow.enabled ? t('flow_disable') : t('flow_enable')}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${flow.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                )}
                <button
                  onClick={e => ctx.open(e, rowMenuItems(flow))}
                  className="shrink-0 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title={t('flow_more_options')}
                >
                  <MoreVertical size={14} />
                </button>
              </div>
              {expandedId === flow.id && <RunsDrawer flowId={flow.id} />}
            </div>
          ))}
        </div>
      </div>

      {meta && <PlatformAutomations builtins={meta.builtins} />}

      {builderOpen && meta && (
        <BuilderModal
          meta={meta}
          flow={editingFlow}
          prefill={builderPrefill}
          onClose={() => { setBuilderOpen(false); setEditingFlow(null); setBuilderPrefill(null) }}
          onSaved={invalidate}
        />
      )}

      {testingFlow && meta && (
        <TestFireModal meta={meta} flow={testingFlow} onClose={() => setTestingFlow(null)} />
      )}

      <ContextMenu state={ctx.state} onClose={ctx.close} />
    </div>
  )
}
