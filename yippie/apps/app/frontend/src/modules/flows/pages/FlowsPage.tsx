import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown, ChevronRight, Pencil, Plus, Sparkles, Trash2, X, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'

interface MetaField {
  key: string
  label: string
  type: string
  options?: string[]
  required?: boolean
}
interface MetaTrigger { key: string; label: string; fields: MetaField[] }
interface MetaAction { key: string; label: string; config_fields: MetaField[] }
interface MetaOption { id: string; name: string }
interface FlowsMeta {
  triggers: MetaTrigger[]
  actions: MetaAction[]
  users: MetaOption[]
  stages: MetaOption[]
  templates: MetaOption[]
}
interface Condition { field: string; op: string; value: any }
interface Action { type: string; config: Record<string, any> }
interface Flow {
  id: string
  name: string
  enabled: boolean
  trigger_type: string
  trigger_config: Record<string, any>
  conditions: Condition[]
  actions: Action[]
  run_count: number
  last_run_at: string | null
  created_at: string
}
interface FlowRun {
  id: string
  status: string
  results: {
    type: string; ok: boolean; skipped: boolean; summary: string
    attempts?: number; pending_retry?: boolean
  }[]
  error: string | null
  created_at: string
}
interface Recipe {
  key: string
  name: string
  description: string
  trigger_type: string
  conditions: Condition[]
  actions: Action[]
}

const OP_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  in: 'is any of',
  gte: 'is at least',
  lte: 'is at most',
}

const RUN_BADGE: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  waiting: 'bg-blue-100 text-blue-700',
  skipped: 'bg-slate-100 text-slate-500',
}

const WAIT_UNITS = ['minutes', 'hours', 'days']

function apiError(err: any): string {
  const detail = err?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Save failed'
}

function triggerLabel(meta: FlowsMeta | undefined, key: string): string {
  return meta?.triggers.find(t => t.key === key)?.label ?? key
}

function actionLabel(meta: FlowsMeta | undefined, key: string): string {
  return meta?.actions.find(a => a.key === key)?.label ?? key
}

function flowSummary(meta: FlowsMeta | undefined, flow: Flow): string {
  const when = `When ${triggerLabel(meta, flow.trigger_type).toLowerCase()}`
  const ifPart = flow.conditions.length
    ? `, if ${flow.conditions.length} condition${flow.conditions.length !== 1 ? 's' : ''} match`
    : ''
  const thenPart = flow.actions.length
    ? ` → ${flow.actions.map(a => actionLabel(meta, a.type).toLowerCase()).join(', ')}`
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
  const unit = WAIT_UNITS.find(u => u in config) ?? 'hours'
  const amount = config[unit] ?? ''
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-slate-600">Wait for</span>
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
      <span className="text-sm text-slate-500">before the next step</span>
    </div>
  )
}

function BuilderModal({
  meta, flow, onClose, onSaved,
}: { meta: FlowsMeta; flow: Flow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(flow?.name ?? '')
  const [triggerType, setTriggerType] = useState(flow?.trigger_type ?? meta.triggers[0]?.key ?? '')
  const [conditions, setConditions] = useState<Condition[]>(flow?.conditions ?? [])
  const [actions, setActions] = useState<Action[]>(flow?.actions ?? [])
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
    if (!name.trim()) { setError('Give the flow a name'); return }
    setError('')
    const body = {
      name: name.trim(),
      trigger_type: triggerType,
      conditions: conditions
        .filter(c => c.field && c.op)
        .map(c => ({
          ...c,
          value: c.op === 'in' && typeof c.value === 'string'
            ? c.value.split(',').map(v => v.trim()).filter(Boolean)
            : c.value,
        })),
      actions,
      enabled,
    }
    saveMut.mutate(body)
  }

  function setCondition(i: number, patch: Partial<Condition>) {
    setConditions(cs => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  }
  function setActionConfig(i: number, key: string, value: any) {
    setActions(as => as.map((a, idx) => (idx === i ? { ...a, config: { ...a.config, [key]: value } } : a)))
  }
  function setWholeConfig(i: number, config: Record<string, any>) {
    setActions(as => as.map((a, idx) => (idx === i ? { ...a, config } : a)))
  }

  function conditionValueInput(c: Condition, i: number) {
    const fieldMeta = trigger?.fields.find(f => f.key === c.field)
    if (c.op === 'in') {
      const display = Array.isArray(c.value) ? c.value.join(', ') : (c.value ?? '')
      return (
        <input
          value={display}
          onChange={e => setCondition(i, { value: e.target.value })}
          placeholder="value1, value2, …"
          className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      )
    }
    if (fieldMeta?.type === 'select') {
      return (
        <select
          value={c.value ?? ''}
          onChange={e => setCondition(i, { value: e.target.value })}
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
            onChange={v => setCondition(i, { value: v })}
            options={meta.stages}
            placeholder="stage…"
          />
        </div>
      )
    }
    return (
      <input
        value={c.value ?? ''}
        onChange={e => setCondition(i, { value: e.target.value })}
        placeholder="value"
        className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Zap size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">{flow ? 'Edit flow' : 'New flow'}</h2>
          <button onClick={onClose} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Flow name…"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* When */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">When</p>
            <select
              value={triggerType}
              onChange={e => { setTriggerType(e.target.value); setConditions([]) }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {meta.triggers.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          {/* If */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">If (all must match)</p>
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={c.field}
                  onChange={e => setCondition(i, { field: e.target.value, value: '' })}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">field…</option>
                  {(trigger?.fields ?? []).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select
                  value={c.op}
                  onChange={e => setCondition(i, { op: e.target.value })}
                  className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {Object.entries(OP_LABELS).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
                </select>
                {conditionValueInput(c, i)}
                <button
                  onClick={() => setConditions(cs => cs.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                  title="Remove condition"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setConditions(cs => [...cs, { field: '', op: 'equals', value: '' }])}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus size={13} /> Add condition
            </button>
          </div>

          {/* Then */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Then</p>
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
                      title="Remove action"
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
              <Plus size={13} /> Add action
            </button>
            <p className="text-xs text-slate-400">
              Tip: use {'{subject}'}, {'{full_name}'} or {'{stage_name}'} in texts to insert event details.
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="accent-blue-600" />
            Enabled
          </label>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {flow ? 'Save flow' : 'Create flow'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- run drawer */

function RunsDrawer({ flowId }: { flowId: string }) {
  const { data: runs = [], isLoading } = useQuery<FlowRun[]>({
    queryKey: ['flow-runs', flowId],
    queryFn: () => api.get(`/flows/${flowId}/runs`).then((r: any) => r.data),
  })
  if (isLoading) return <p className="px-6 py-4 text-xs text-slate-400">Loading runs…</p>
  if (runs.length === 0) return <p className="px-6 py-4 text-xs text-slate-400">No runs yet — the flow hasn't been triggered.</p>
  return (
    <div className="divide-y divide-slate-50 border-t border-slate-100 bg-slate-50/50">
      {runs.map(run => (
        <div key={run.id} className="px-6 py-2.5 flex items-start gap-3 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-semibold shrink-0 ${RUN_BADGE[run.status] ?? RUN_BADGE.skipped}`}>
            {run.status}
          </span>
          <div className="flex-1 min-w-0 space-y-0.5">
            {run.results.length === 0 && <p className="text-slate-400">Conditions did not match</p>}
            {run.results.map((r, i) => (
              <p
                key={i}
                className={r.pending_retry ? 'text-amber-600' : r.ok ? 'text-slate-600' : 'text-slate-400'}
              >
                {r.summary}
                {typeof r.attempts === 'number' && r.attempts > 1 ? ` (attempt ${r.attempts})` : ''}
              </p>
            ))}
            {run.error && <p className="text-red-500 truncate">{run.error}</p>}
          </div>
          <span className="text-slate-400 shrink-0">{new Date(run.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------- page */

export default function FlowsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
  const installMut = useMutation({
    mutationFn: (key: string) => api.post(`/flows/recipes/${key}/install`).then((r: any) => r.data),
    onSuccess: (flow: Flow) => {
      invalidate()
      setEditingFlow(flow)
      setBuilderOpen(true)
      toast.success('Recipe installed — finish setting it up, then enable it')
    },
  })

  function openEdit(flow: Flow) { setEditingFlow(flow); setBuilderOpen(true) }
  function openNew() { setEditingFlow(null); setBuilderOpen(true) }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Flows</h1>
          <p className="text-sm text-slate-500">Automations that connect your modules: when something happens, Yippie acts.</p>
        </div>
        {isAdmin && (
          <button
            onClick={openNew}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-lg hover:opacity-90"
          >
            <Plus size={14} /> New flow
          </button>
        )}
      </div>

      {/* Recipes */}
      {isAdmin && recipes.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Sparkles size={12} /> Ready-made recipes
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recipes.map(r => (
              <div key={r.key} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col">
                <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                <p className="text-xs text-slate-500 mt-1 flex-1">{r.description}</p>
                <button
                  onClick={() => installMut.mutate(r.key)}
                  disabled={installMut.isPending}
                  className="mt-3 self-start text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  Install recipe
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flow list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-100">
          <Zap size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Your flows</h2>
          <span className="ml-auto text-xs text-slate-400">{flows.length} flow{flows.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading && <p className="px-6 py-8 text-sm text-slate-400 text-center">Loading…</p>}
        {!isLoading && flows.length === 0 && (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">
            No flows yet. {isAdmin ? 'Install a recipe or create one from scratch.' : 'Ask an admin to set one up.'}
          </p>
        )}

        <div className="divide-y divide-slate-50">
          {flows.map(flow => (
            <div key={flow.id}>
              <div className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50">
                <button
                  onClick={() => setExpandedId(expandedId === flow.id ? null : flow.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
                  title="Show recent runs"
                >
                  {expandedId === flow.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{flow.name}</p>
                  <p className="text-xs text-slate-400 truncate">{flowSummary(meta, flow)}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0" title="Total runs">
                  {flow.run_count} run{flow.run_count !== 1 ? 's' : ''}
                </span>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => toggleMut.mutate({ id: flow.id, enabled: !flow.enabled })}
                      className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${flow.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      title={flow.enabled ? 'Disable' : 'Enable'}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${flow.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                    <button
                      onClick={() => openEdit(flow)}
                      className="shrink-0 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${flow.name}"?`)) deleteMut.mutate(flow.id) }}
                      className="shrink-0 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
              {expandedId === flow.id && <RunsDrawer flowId={flow.id} />}
            </div>
          ))}
        </div>
      </div>

      {builderOpen && meta && (
        <BuilderModal
          meta={meta}
          flow={editingFlow}
          onClose={() => { setBuilderOpen(false); setEditingFlow(null) }}
          onSaved={invalidate}
        />
      )}
    </div>
  )
}
