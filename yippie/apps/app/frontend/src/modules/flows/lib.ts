// Shared flows types + helpers used by both the list/builder page (FlowsPage)
// and the [FLOW3] canvas page. Mirrors the backend meta served by /flows/meta.
export interface MetaField {
  key: string
  label: string
  type: string
  options?: string[]
  required?: boolean
}
export interface MetaTrigger { key: string; label: string; fields: MetaField[] }
export interface MetaAction { key: string; label: string; config_fields: MetaField[] }
export interface MetaOption { id: string; name: string }
export interface FlowsMeta {
  triggers: MetaTrigger[]
  actions: MetaAction[]
  users: MetaOption[]
  stages: MetaOption[]
  templates: MetaOption[]
}
export interface Condition { field: string; op: string; value: any }
// id is the stable per action identity stamped into flow_runs.results ([FLOW3])
// so run replay survives reorders; legacy actions may not carry one yet.
export interface Action { id?: string; type: string; config: Record<string, any> }
export interface Flow {
  id: string
  name: string
  enabled: boolean
  trigger_type: string
  trigger_config: Record<string, any>
  conditions: Condition[] | Condition[][] // flat (legacy) or grouped OR-of-AND
  actions: Action[]
  run_count: number
  last_run_at: string | null
  created_at: string
}
export interface RunResult {
  type: string
  ok: boolean
  skipped: boolean
  summary: string
  attempts?: number
  pending_retry?: boolean
  action_id?: string | null
}
export interface FlowRun {
  id: string
  status: string
  event: { fields?: Record<string, any> } & Record<string, any>
  results: RunResult[]
  error: string | null
  created_at: string
}

export const OP_LABELS: Record<string, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  in: 'is any of',
  gte: 'is at least',
  lte: 'is at most',
}

export const RUN_BADGE: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  waiting: 'bg-blue-100 text-blue-700',
  skipped: 'bg-slate-100 text-slate-500',
}

export const WAIT_UNITS = ['minutes', 'hours', 'days']
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function apiError(err: any): string {
  const detail = err?.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Save failed'
}

export function triggerLabel(meta: FlowsMeta | undefined, key: string): string {
  return meta?.triggers.find(t => t.key === key)?.label ?? key
}

export function actionLabel(meta: FlowsMeta | undefined, key: string): string {
  return meta?.actions.find(a => a.key === key)?.label ?? key
}

// Conditions are stored as OR-of-AND groups [[A,B],[C]]; a legacy flat list
// [A,B] is one group. Normalize either shape to grouped for rendering.
export function toGroups(raw: any[]): Condition[][] {
  if (!raw || raw.length === 0) return []
  return Array.isArray(raw[0]) ? (raw as Condition[][]) : [raw as Condition[]]
}

export function waitSummary(config: Record<string, any>): string {
  for (const unit of WAIT_UNITS) {
    if (unit in config) {
      const amount = config[unit]
      const label = amount === 1 ? unit.slice(0, -1) : unit
      return `Wait ${amount} ${label}`
    }
  }
  return 'Wait'
}

export function scheduleSummary(config: Record<string, any>): string {
  const time = config.time ?? '—'
  if (config.frequency === 'weekly') {
    const day = WEEKDAYS[Number(config.weekday ?? 0)] ?? 'Monday'
    return `Every ${day} at ${time}`
  }
  if (config.frequency === 'daily') return `Every day at ${time}`
  return 'Schedule not set'
}

// Fresh client-side id for a new action; round-trips through the API so the
// engine can stamp it into run results. Matches the backend's alnum shape.
export function newActionId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

export function conditionLine(
  meta: FlowsMeta | undefined, trigger: MetaTrigger | undefined, c: Condition,
): string {
  const fieldLabel = trigger?.fields.find(f => f.key === c.field)?.label ?? c.field
  const value = Array.isArray(c.value) ? c.value.join(', ') : String(c.value ?? '')
  const stage = meta?.stages.find(s => s.id === c.value)
  return `${fieldLabel} ${OP_LABELS[c.op] ?? c.op} ${stage ? stage.name : value}`
}
