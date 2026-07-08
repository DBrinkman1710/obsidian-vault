// [FLOW3] Deterministic top-to-bottom auto layout for the flow canvas.
// Flows are still linear this phase (trigger → OR groups → action chain), so a
// small pure function beats a dagre dependency; [FLOW4]'s branch DAGs are where
// a real layout engine earns its keep.
import type { Edge, Node } from '@xyflow/react'
import {
  Action, Condition, FlowsMeta, MetaField, actionLabel, conditionLine,
  scheduleSummary, triggerLabel, waitSummary,
} from '../lib'
import { ReplayState } from './replay'
import { NODE_WIDTH } from './nodes'

const GAP_X = 48
const GAP_Y = 56
const CENTER_X = 0

export interface FlowDraft {
  name: string
  trigger_type: string
  trigger_config: Record<string, any>
  groups: Condition[][]
  actions: Action[]
  enabled: boolean
}

export type Selection =
  | { kind: 'trigger' }
  | { kind: 'group'; index: number }
  | { kind: 'action'; index: number }

export function nodeIdFor(sel: Selection): string {
  if (sel.kind === 'trigger') return 'trigger'
  return `${sel.kind}-${sel.index}`
}

function estimateHeight(lines: number): number {
  return 58 + lines * 20
}

function configLines(meta: FlowsMeta | undefined, action: Action): string[] {
  if (action.type === 'wait') return []
  const fields: MetaField[] =
    meta?.actions.find(a => a.key === action.type)?.config_fields ?? []
  const lines: string[] = []
  for (const f of fields) {
    const value = action.config?.[f.key]
    if (value === undefined || value === null || value === '') continue
    const named =
      meta?.users.find(o => o.id === value)?.name ??
      meta?.stages.find(o => o.id === value)?.name ??
      meta?.templates.find(o => o.id === value)?.name
    lines.push(`${f.label}: ${named ?? String(value)}`)
  }
  return lines
}

export function buildGraph(
  draft: FlowDraft,
  meta: FlowsMeta | undefined,
  replay: ReplayState | null,
  selection: Selection | null,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const trigger = meta?.triggers.find(t => t.key === draft.trigger_type)
  const selectedId = selection ? nodeIdFor(selection) : null
  const replayActive = replay !== null

  let y = 0

  // --- trigger
  nodes.push({
    id: 'trigger',
    type: 'trigger',
    position: { x: CENTER_X, y },
    draggable: false,
    data: {
      label: triggerLabel(meta, draft.trigger_type),
      detail: draft.trigger_type === 'schedule' ? scheduleSummary(draft.trigger_config) : null,
      selected: selectedId === 'trigger',
      dimmed: false,
    },
  })
  y += estimateHeight(draft.trigger_type === 'schedule' ? 2 : 1) + GAP_Y

  // --- OR condition groups, side by side
  const groups = draft.groups
  let lastRowIds = ['trigger']
  if (groups.length > 0) {
    // Positions are top-left corners; center the OR row on the single-column
    // spine (whose nodes sit at x = CENTER_X, i.e. center CENTER_X + width/2).
    const rowWidth = groups.length * NODE_WIDTH + (groups.length - 1) * GAP_X
    const startX = CENTER_X + NODE_WIDTH / 2 - rowWidth / 2
    let tallest = 0
    groups.forEach((group, gi) => {
      const id = `group-${gi}`
      const lines = group.map(c => conditionLine(meta, trigger, c))
      nodes.push({
        id,
        type: 'group',
        position: { x: startX + gi * (NODE_WIDTH + GAP_X), y },
        draggable: false,
        data: {
          index: gi,
          lines,
          matched: replay ? replay.groupMatch[gi] ?? null : null,
          selected: selectedId === id,
          dimmed: false,
        },
      })
      edges.push({
        id: `e-trigger-${id}`,
        source: 'trigger',
        target: id,
        label: groups.length > 1 ? (gi === 0 ? 'if' : 'or') : 'if',
        style: replay && replay.groupMatch[gi] === false ? { opacity: 0.35 } : undefined,
      })
      tallest = Math.max(tallest, estimateHeight(Math.max(lines.length, 1)))
    })
    y += tallest + GAP_Y
    lastRowIds = groups.map((_, gi) => `group-${gi}`)
  }

  // --- action chain
  draft.actions.forEach((action, ai) => {
    const id = `action-${ai}`
    const isWait = action.type === 'wait'
    const lines = configLines(meta, action)
    const badge = replay ? replay.actionBadges[ai] : null
    nodes.push({
      id,
      type: 'action',
      position: { x: CENTER_X, y },
      draggable: false,
      data: {
        label: isWait ? waitSummary(action.config ?? {}) : actionLabel(meta, action.type),
        lines,
        isWait,
        badge,
        selected: selectedId === id,
        dimmed: replayActive && badge === null,
      },
    })
    for (const sourceId of lastRowIds) {
      edges.push({
        id: `e-${sourceId}-${id}`,
        source: sourceId,
        target: id,
        label: ai === 0 ? (groups.length > 0 ? 'then' : 'always') : undefined,
        style:
          replay && sourceId.startsWith('group-') &&
          replay.groupMatch[Number(sourceId.split('-')[1])] === false
            ? { opacity: 0.35 }
            : replayActive && badge === null
              ? { opacity: 0.35 }
              : undefined,
      })
    }
    y += estimateHeight(Math.max(lines.length, isWait ? 0 : 1)) + GAP_Y
    lastRowIds = [id]
  })

  return { nodes, edges }
}
