// Shared flows types + helpers used by both the list/builder page (FlowsPage)
// and the [FLOW3] canvas page. Mirrors the backend meta served by /flows/meta.
export interface MetaField {
  key: string
  label: string
  type: string
  options?: string[]
  required?: boolean
}
// free_fields ([FLOW5] webhook trigger): payload keys are unknown at build
// time, so the builder offers a free-text field-name input instead of a select.
// [FLOW7] `module` is the emitting module id (null for schedule/webhook) — the
// builder picker groups triggers by it via groupTriggers.
export interface MetaTrigger { key: string; label: string; fields: MetaField[]; free_fields?: boolean; module?: string | null }
export interface MetaAction { key: string; label: string; config_fields: MetaField[] }
export interface MetaOption { id: string; name: string }
// [FLOW8] a built-in platform automation — always-on, read-only. Surfaced on the
// Flows page so tenants can see what Yippie already does automatically.
export interface Builtin {
  key: string
  name: string
  description: string
  module: string | null
  cadence: string
  settings_path?: string
}
export interface FlowsMeta {
  triggers: MetaTrigger[]
  actions: MetaAction[]
  users: MetaOption[]
  stages: MetaOption[]
  templates: MetaOption[]
  builtins: Builtin[]
}
export interface Condition { field: string; op: string; value: any }
// id is the stable per action identity stamped into flow_runs.results ([FLOW3])
// so run replay survives reorders; legacy actions may not carry one yet.
// A 'branch' node ([FLOW4]) carries config.conditions: Condition[][].
export interface Action { id?: string; type: string; config: Record<string, any> }
// [FLOW4] the branched storage shape of `actions`: a small DAG. A linear flow
// keeps the plain Action[] list (the modal builder's shape).
export interface GraphEdge { from: string; to: string; when: 'match' | 'else' | null }
export interface FlowGraph { nodes: Action[]; edges: GraphEdge[] }
export type FlowActions = Action[] | FlowGraph
export interface Flow {
  id: string
  name: string
  enabled: boolean
  // [FLOW9] Yippie installed showcase flow: view only on the canvas (duplicate
  // to customise), deletable, exempt from the plan's active flow cap.
  is_default: boolean
  trigger_type: string
  trigger_config: Record<string, any>
  conditions: Condition[] | Condition[][] // flat (legacy) or grouped OR-of-AND
  actions: FlowActions
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
  matched?: boolean // branch results: which edge the run took
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

// [FLOW7] Human labels for the trigger picker's optgroups, keyed by module id.
export const MODULE_LABELS: Record<string, string> = {
  tickets: 'Tickets',
  contacts: 'Contacts',
  pipeline: 'Pipeline',
  inbox: 'Inbox',
  chat: 'Live chat',
  booking: 'Bookings',
  marketing: 'Marketing',
  contracts: 'Contracts',
  billing: 'Billing',
  tracking: 'Orders',
  saas: 'SaaS',
}

// Group triggers by their emitting module, preserving each module's first
// appearance order; module null/undefined (schedule, webhook) → 'General'.
export function groupTriggers(triggers: MetaTrigger[]): [string, MetaTrigger[]][] {
  const order: string[] = []
  const byGroup = new Map<string, MetaTrigger[]>()
  for (const t of triggers) {
    const group = t.module ? (MODULE_LABELS[t.module] ?? t.module) : 'General'
    if (!byGroup.has(group)) {
      byGroup.set(group, [])
      order.push(group)
    }
    byGroup.get(group)!.push(t)
  }
  return order.map(g => [g, byGroup.get(g)!])
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

/* ------------------------------------------------------- [FLOW4] branching */

export function isGraph(actions: FlowActions): actions is FlowGraph {
  return !Array.isArray(actions)
}

// Executable nodes of either stored shape (branch nodes route, they don't run).
export function actionNodes(actions: FlowActions): Action[] {
  const nodes = isGraph(actions) ? actions.nodes ?? [] : actions ?? []
  return nodes.filter(n => n.type !== 'branch')
}

// The canvas edits a TREE view of the graph: a branch step carries its two
// legs inline (a branch always ends its own chain — the legs continue below).
// Every tree is a valid DAG; the graphs our builders write are always trees.
export interface Step extends Action {
  id: string
  match?: Step[] // only on type === 'branch'
  else?: Step[]
}

// Graph (or legacy list) → tree. Returns null for shapes the canvas can't
// edit (reconverging DAGs, cycles, dangling edges) — only possible via the
// raw API, never via our builders.
export function graphToTree(actions: FlowActions): Step[] | null {
  if (!isGraph(actions)) {
    // Deterministic fallback ids for legacy pre-[FLOW3] actions — random ids
    // here would make the canvas dirty-check flap (draftFrom runs per render).
    return (actions ?? []).map((a, i) => ({
      ...a, id: a.id ?? `pos_${i}`, config: { ...(a.config ?? {}) },
    }))
  }
  const nodes = actions.nodes ?? []
  const edges = actions.edges ?? []
  if (nodes.length === 0) return []
  const byId = new Map(nodes.map(n => [n.id as string, n]))
  const incoming = new Map<string, number>(nodes.map(n => [n.id as string, 0]))
  for (const e of edges) {
    if (!byId.has(e.from) || !byId.has(e.to)) return null
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1)
  }
  if ([...incoming.values()].some(c => c > 1)) return null // reconverging → not a tree
  const roots = nodes.filter(n => (incoming.get(n.id as string) ?? 0) === 0)
  if (roots.length !== 1) return null
  const outs = (id: string) => edges.filter(e => e.from === id)
  const seen = new Set<string>()

  function chain(startId: string | undefined): Step[] | null {
    const steps: Step[] = []
    let cur = startId
    while (cur) {
      if (seen.has(cur)) return null // cycle guard
      seen.add(cur)
      const node = byId.get(cur)
      if (!node) return null
      const step: Step = { ...node, id: cur, config: { ...(node.config ?? {}) } }
      if (node.type === 'branch') {
        const out = outs(cur)
        const matchLeg = chain(out.find(e => e.when === 'match')?.to)
        const elseLeg = chain(out.find(e => e.when === 'else')?.to)
        if (matchLeg === null || elseLeg === null) return null
        step.match = matchLeg
        step.else = elseLeg
        steps.push(step)
        return steps
      }
      steps.push(step)
      const out = outs(cur)
      if (out.length > 1) return null
      cur = out[0]?.to
    }
    return steps
  }
  return chain(roots[0].id as string)
}

export function treeHasBranch(steps: Step[]): boolean {
  return steps.some(s =>
    s.type === 'branch' || treeHasBranch(s.match ?? []) || treeHasBranch(s.else ?? []))
}

// Tree → the stored shape. A branch-free tree serializes back to the plain
// linear list, so the modal builder stays usable until a branch is added.
export function treeToActions(steps: Step[]): FlowActions {
  if (!treeHasBranch(steps)) {
    return steps.map(({ match: _m, else: _e, ...action }) => action)
  }
  const nodes: Action[] = []
  const edges: GraphEdge[] = []
  function walk(list: Step[], from: string | null, when: GraphEdge['when']) {
    let prev = from
    let prevWhen = when
    for (const step of list) {
      const { match, else: elseLeg, ...node } = step
      nodes.push(node)
      if (prev) edges.push({ from: prev, to: step.id, when: prevWhen })
      prevWhen = null
      if (step.type === 'branch') {
        walk(match ?? [], step.id, 'match')
        walk(elseLeg ?? [], step.id, 'else')
        return
      }
      prev = step.id
    }
  }
  walk(steps, null, null)
  return { nodes, edges }
}

// Locate a step by id anywhere in the tree — returns its sibling list so
// callers can splice/reorder in place (on a structuredClone'd tree).
export interface StepLoc { list: Step[]; index: number; parent: Step | null }
export function findStep(steps: Step[], id: string, parent: Step | null = null): StepLoc | null {
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    if (s.id === id) return { list: steps, index: i, parent }
    if (s.type === 'branch') {
      const found = findStep(s.match ?? [], id, s) ?? findStep(s.else ?? [], id, s)
      if (found) return found
    }
  }
  return null
}

// A chain can only grow while it doesn't end in a branch (a branch ends its
// chain — new steps go into its legs instead).
export function canAppend(list: Step[]): boolean {
  return list.length === 0 || list[list.length - 1].type !== 'branch'
}

export function flattenSteps(steps: Step[]): Step[] {
  const flat: Step[] = []
  for (const s of steps) {
    flat.push(s)
    if (s.type === 'branch') {
      flat.push(...flattenSteps(s.match ?? []), ...flattenSteps(s.else ?? []))
    }
  }
  return flat
}

export function conditionLine(
  meta: FlowsMeta | undefined, trigger: MetaTrigger | undefined, c: Condition,
): string {
  const fieldLabel = trigger?.fields.find(f => f.key === c.field)?.label ?? c.field
  const value = Array.isArray(c.value) ? c.value.join(', ') : String(c.value ?? '')
  const stage = meta?.stages.find(s => s.id === c.value)
  return `${fieldLabel} ${OP_LABELS[c.op] ?? c.op} ${stage ? stage.name : value}`
}
