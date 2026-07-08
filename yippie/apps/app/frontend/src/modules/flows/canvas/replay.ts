// [FLOW3] Run replay: map a historical flow_runs row onto the CURRENT canvas.
// Actions match primarily by the stable action_id stamped into results; runs
// recorded before ids existed fall back to list position (safe while flows are
// linear). Condition groups are re-evaluated client-side against the run's
// frozen event fields — mirroring backend conditions.py semantics — so the
// canvas can show which OR group let the run through.
import { Action, Condition, FlowRun, RunResult } from '../lib'

export type BadgeTone = 'ok' | 'fail' | 'skip' | 'retry'
export interface NodeBadge { tone: BadgeTone; label: string }

export interface ReplayState {
  run: FlowRun
  /** Per OR-group: true=matched, false=missed, null=unknown (no fields). */
  groupMatch: (boolean | null)[]
  /** Per current action: badge from the run's results, null = never reached. */
  actionBadges: (NodeBadge | null)[]
}

function norm(value: any): any {
  return typeof value === 'string' ? value.trim().toLowerCase() : value
}

function asNumber(value: any): number | null {
  if (typeof value === 'boolean') return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

// Mirrors app/modules/flows/conditions.py evaluate_condition: a missing field
// never matches (also for not_equals).
export function evaluateCondition(c: Condition, fields: Record<string, any>): boolean {
  const actual = fields[c.field]
  if (actual === null || actual === undefined) return false
  const expected = c.value
  switch (c.op) {
    case 'equals':
      return norm(actual) === norm(expected)
    case 'not_equals':
      return norm(actual) !== norm(expected)
    case 'contains':
      if (Array.isArray(actual)) return actual.map(norm).includes(norm(expected))
      return typeof actual === 'string' && String(actual).trim().toLowerCase().includes(String(norm(expected)))
    case 'in':
      if (!Array.isArray(expected)) return false
      return expected.map(norm).includes(norm(actual))
    case 'gte':
    case 'lte': {
      const a = asNumber(actual)
      const b = asNumber(expected)
      if (a === null || b === null) return false
      return c.op === 'gte' ? a >= b : a <= b
    }
    default:
      return false
  }
}

function badgeFor(r: RunResult): NodeBadge {
  if (r.pending_retry) {
    return { tone: 'retry', label: `retrying (attempt ${r.attempts ?? 1})` }
  }
  if (r.ok) {
    const attempts = r.attempts ?? 1
    return { tone: 'ok', label: attempts > 1 ? `ok (attempt ${attempts})` : 'ok' }
  }
  if (r.skipped) return { tone: 'skip', label: 'skipped' }
  const attempts = r.attempts ?? 1
  return { tone: 'fail', label: attempts > 1 ? `failed (${attempts} attempts)` : 'failed' }
}

export function computeReplay(
  run: FlowRun, groups: Condition[][], actions: Action[],
): ReplayState {
  // --- condition groups
  const fields = run.event?.fields
  let groupMatch: (boolean | null)[]
  if (run.status === 'skipped') {
    groupMatch = groups.map(() => false)
  } else if (fields && typeof fields === 'object') {
    groupMatch = groups.map(g => g.every(c => evaluateCondition(c, fields)))
  } else {
    groupMatch = groups.map(() => null)
  }

  // --- actions
  const results = run.results ?? []
  const byId = new Map<string, RunResult>()
  for (const r of results) {
    if (r.action_id) byId.set(r.action_id, r)
  }
  const actionBadges = actions.map((a, i) => {
    const matched = a.id ? byId.get(a.id) : undefined
    if (matched) return badgeFor(matched)
    // Positional fallback for pre-id runs: only trust it when the type lines up
    // and the stored result carries no id of its own (else it's a different action).
    const positional = results[i]
    if (positional && !positional.action_id && positional.type === a.type) {
      return badgeFor(positional)
    }
    return null
  })

  return { run, groupMatch, actionBadges }
}
