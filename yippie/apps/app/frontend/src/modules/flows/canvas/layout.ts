// [FLOW3] Deterministic top-to-bottom auto layout for the flow canvas.
// [FLOW4] grew it into a recursive tree layout: a branch node splits into two
// legs (match left, else right) whose subtree widths are computed bottom-up —
// still a pure function, no layout engine dependency needed for trees this
// small (the backend caps graphs at 25 nodes).
import type { Edge, Node } from '@xyflow/react'
import {
  Condition, FlowsMeta, MetaField, MetaTrigger, Step, actionLabel, conditionLine,
  scheduleSummary, triggerLabel, waitSummary,
} from '../lib'
import { ReplayState } from './replay'
import { NODE_WIDTH } from './nodes'

const GAP_X = 48
const GAP_Y = 56
const CENTER_X = 0

export type CanvasPositions = Map<string, { x: number; y: number }>

export interface FlowDraft {
  name: string
  trigger_type: string
  trigger_config: Record<string, any>
  groups: Condition[][]
  steps: Step[]
  enabled: boolean
}

export type Selection =
  | { kind: 'trigger' }
  | { kind: 'group'; index: number }
  | { kind: 'step'; id: string }

export function nodeIdFor(sel: Selection): string {
  if (sel.kind === 'trigger') return 'trigger'
  if (sel.kind === 'group') return `group-${sel.index}`
  return `step:${sel.id}`
}

function estimateHeight(lines: number): number {
  return 58 + lines * 20
}

function configLines(meta: FlowsMeta | undefined, action: Step): string[] {
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

// Branch condition groups rendered as compact card lines ("A and B" / "or C").
function branchLines(
  meta: FlowsMeta | undefined, trigger: MetaTrigger | undefined, step: Step,
): string[] {
  const groups: Condition[][] = (step.config?.conditions as Condition[][]) ?? []
  return groups.map((group, gi) => {
    const joined = group.map(c => conditionLine(meta, trigger, c)).join(' and ')
    return gi > 0 ? `or ${joined}` : joined
  })
}

// --- subtree width math (bottom-up, an empty leg renders a ghost node)

function chainWidth(steps: Step[]): number {
  if (steps.length === 0) return NODE_WIDTH
  return Math.max(...steps.map(subtreeWidth))
}

function subtreeWidth(step: Step): number {
  if (step.type !== 'branch') return NODE_WIDTH
  return chainWidth(step.match ?? []) + GAP_X + chainWidth(step.else ?? [])
}

interface Ctx {
  nodes: Node[]
  edges: Edge[]
  meta: FlowsMeta | undefined
  trigger: MetaTrigger | undefined
  replay: ReplayState | null
  selectedId: string | null
  positions: CanvasPositions
}

interface EdgeSource {
  ids: string[] // multiple only at the top level (each OR group → first step)
  label?: string
  handle?: string // branch source handle: 'match' | 'else'
  dimmed?: boolean
}

function pushEdges(ctx: Ctx, source: EdgeSource, targetId: string, targetDimmed: boolean) {
  for (const sourceId of source.ids) {
    const groupMiss =
      ctx.replay && sourceId.startsWith('group-') &&
      ctx.replay.groupMatch[Number(sourceId.split('-')[1])] === false
    ctx.edges.push({
      id: `e-${sourceId}-${source.handle ?? ''}-${targetId}`,
      source: sourceId,
      sourceHandle: source.handle,
      target: targetId,
      label: source.label,
      style: groupMiss || source.dimmed || (ctx.replay && targetDimmed)
        ? { opacity: 0.35 }
        : undefined,
    })
  }
}

// Lay out one chain centred on `axis` starting at `y`; returns the bottom y.
function layoutChain(ctx: Ctx, steps: Step[], axis: number, y: number, source: EdgeSource): number {
  const replayActive = ctx.replay !== null

  if (steps.length === 0) {
    // Empty branch leg → ghost marker so the path stays visible on the canvas.
    const ghostId = `ghost-${source.ids[0]}-${source.handle ?? 'end'}`
    const dimmed = !!(replayActive && source.dimmed)
    ctx.nodes.push({
      id: ghostId,
      type: 'ghost',
      position: { x: axis - NODE_WIDTH / 2, y },
      draggable: false,
      selectable: false,
      data: { dimmed },
    })
    pushEdges(ctx, source, ghostId, dimmed)
    return y + estimateHeight(0)
  }

  let currentSource = source
  for (const step of steps) {
    const id = `step:${step.id}`
    const badge = ctx.replay ? ctx.replay.badges[step.id] ?? null : null
    const dimmed = replayActive && badge === null

    if (step.type === 'branch') {
      const lines = branchLines(ctx.meta, ctx.trigger, step)
      ctx.nodes.push({
        id,
        type: 'branch',
        position: ctx.positions.get(step.id) ?? { x: axis - NODE_WIDTH / 2, y },
        data: { lines, badge, selected: ctx.selectedId === id, dimmed },
      })
      pushEdges(ctx, currentSource, id, dimmed)
      y += estimateHeight(Math.max(lines.length, 1)) + GAP_Y

      const matchLeg = step.match ?? []
      const elseLeg = step.else ?? []
      const matchW = chainWidth(matchLeg)
      const elseW = chainWidth(elseLeg)
      const total = matchW + GAP_X + elseW
      const taken = ctx.replay ? ctx.replay.branchTaken[step.id] : undefined
      const matchBottom = layoutChain(ctx, matchLeg, axis - total / 2 + matchW / 2, y, {
        ids: [id], label: 'yes', handle: 'match',
        dimmed: replayActive && taken !== true,
      })
      const elseBottom = layoutChain(ctx, elseLeg, axis + total / 2 - elseW / 2, y, {
        ids: [id], label: 'no', handle: 'else',
        dimmed: replayActive && taken !== false,
      })
      return Math.max(matchBottom, elseBottom)
    }

    const isWait = step.type === 'wait'
    const lines = configLines(ctx.meta, step)
    ctx.nodes.push({
      id,
      type: 'action',
      position: ctx.positions.get(step.id) ?? { x: axis - NODE_WIDTH / 2, y },
      data: {
        label: isWait ? waitSummary(step.config ?? {}) : actionLabel(ctx.meta, step.type),
        lines,
        isWait,
        badge,
        selected: ctx.selectedId === id,
        dimmed,
      },
    })
    pushEdges(ctx, currentSource, id, dimmed)
    y += estimateHeight(Math.max(lines.length, isWait ? 0 : 1)) + GAP_Y
    currentSource = { ids: [id], dimmed }
  }
  return y
}

export function buildGraph(
  draft: FlowDraft,
  meta: FlowsMeta | undefined,
  replay: ReplayState | null,
  selection: Selection | null,
  positions: CanvasPositions = new Map(),
): { nodes: Node[]; edges: Edge[] } {
  const trigger = meta?.triggers.find(t => t.key === draft.trigger_type)
  const ctx: Ctx = {
    nodes: [],
    edges: [],
    meta,
    trigger,
    replay,
    selectedId: selection ? nodeIdFor(selection) : null,
    positions,
  }

  let y = 0
  const centerAxis = CENTER_X + NODE_WIDTH / 2

  // --- trigger
  ctx.nodes.push({
    id: 'trigger',
    type: 'trigger',
    position: positions.get('trigger') ?? { x: CENTER_X, y },
    data: {
      label: triggerLabel(meta, draft.trigger_type),
      detail: draft.trigger_type === 'schedule' ? scheduleSummary(draft.trigger_config) : null,
      selected: ctx.selectedId === 'trigger',
      dimmed: false,
    },
  })
  y += estimateHeight(draft.trigger_type === 'schedule' ? 2 : 1) + GAP_Y

  // --- OR condition groups, side by side
  const groups = draft.groups
  let entryIds = ['trigger']
  if (groups.length > 0) {
    const rowWidth = groups.length * NODE_WIDTH + (groups.length - 1) * GAP_X
    const startX = centerAxis - rowWidth / 2
    let tallest = 0
    groups.forEach((group, gi) => {
      const id = `group-${gi}`
      const lines = group.map(c => conditionLine(meta, trigger, c))
      ctx.nodes.push({
        id,
        type: 'group',
        position: positions.get(id) ?? { x: startX + gi * (NODE_WIDTH + GAP_X), y },
        data: {
          index: gi,
          lines,
          matched: replay ? replay.groupMatch[gi] ?? null : null,
          selected: ctx.selectedId === id,
          dimmed: false,
        },
      })
      ctx.edges.push({
        id: `e-trigger-${id}`,
        source: 'trigger',
        target: id,
        label: groups.length > 1 ? (gi === 0 ? 'if' : 'or') : 'if',
        style: replay && replay.groupMatch[gi] === false ? { opacity: 0.35 } : undefined,
      })
      tallest = Math.max(tallest, estimateHeight(Math.max(lines.length, 1)))
    })
    y += tallest + GAP_Y
    entryIds = groups.map((_, gi) => `group-${gi}`)
  }

  // --- step tree
  if (draft.steps.length > 0) {
    layoutChain(ctx, draft.steps, centerAxis, y, {
      ids: entryIds,
      label: groups.length > 0 ? 'then' : 'always',
    })
  }

  return { nodes: ctx.nodes, edges: ctx.edges }
}
