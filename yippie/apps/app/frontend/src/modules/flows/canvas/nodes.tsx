// [FLOW3] Custom React Flow nodes for the flow canvas. Pure presentational —
// layout.ts decides positions, FlowCanvasPage owns state and selection.
import { Handle, Position } from '@xyflow/react'
import { CalendarClock, CheckCircle2, Filter, Timer, XCircle, Zap } from 'lucide-react'
import { NodeBadge } from './replay'

export const NODE_WIDTH = 260

const TONE_CLASSES: Record<string, string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  fail: 'bg-red-100 text-red-700',
  skip: 'bg-amber-100 text-amber-700',
  retry: 'bg-amber-100 text-amber-700',
}

function Badge({ badge }: { badge: NodeBadge | null | undefined }) {
  if (!badge) return null
  const Icon = badge.tone === 'ok' ? CheckCircle2 : badge.tone === 'fail' ? XCircle : Timer
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TONE_CLASSES[badge.tone]}`}>
      <Icon size={10} /> {badge.label}
    </span>
  )
}

function card(selected: boolean, dimmed: boolean): string {
  return [
    'rounded-2xl border bg-white shadow-sm px-4 py-3 space-y-1.5 transition-opacity',
    selected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-slate-200',
    dimmed ? 'opacity-40' : '',
  ].join(' ')
}

export interface TriggerNodeData {
  label: string
  detail: string | null // schedule summary, when applicable
  selected: boolean
  dimmed: boolean
}

export function TriggerNode({ data }: { data: TriggerNodeData }) {
  return (
    <div style={{ width: NODE_WIDTH }} className={card(data.selected, data.dimmed)}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
        <Zap size={10} /> When
      </p>
      <p className="text-sm font-semibold text-slate-800">{data.label}</p>
      {data.detail && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <CalendarClock size={11} /> {data.detail}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </div>
  )
}

export interface GroupNodeData {
  index: number
  lines: string[]
  matched: boolean | null // replay: true/false, null = neutral (no replay/unknown)
  selected: boolean
  dimmed: boolean
}

export function GroupNode({ data }: { data: GroupNodeData }) {
  return (
    <div style={{ width: NODE_WIDTH }} className={card(data.selected, data.dimmed)}>
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
          <Filter size={10} /> If
        </p>
        {data.matched === true && <Badge badge={{ tone: 'ok', label: 'matched' }} />}
        {data.matched === false && <Badge badge={{ tone: 'skip', label: 'no match' }} />}
      </div>
      {data.lines.length === 0 && <p className="text-xs text-slate-400">No conditions</p>}
      {data.lines.map((line, i) => (
        <p key={i} className="text-xs text-slate-600">
          {i > 0 && <span className="text-slate-400 font-semibold">and </span>}
          {line}
        </p>
      ))}
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </div>
  )
}

export interface ActionNodeData {
  label: string
  lines: string[]
  isWait: boolean
  badge: NodeBadge | null
  selected: boolean
  dimmed: boolean
}

export function ActionNode({ data }: { data: ActionNodeData }) {
  return (
    <div style={{ width: NODE_WIDTH }} className={card(data.selected, data.dimmed)}>
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
          {data.isWait ? <Timer size={10} /> : <Zap size={10} />} {data.isWait ? 'Wait' : 'Then'}
        </p>
        <Badge badge={data.badge} />
      </div>
      <p className="text-sm font-semibold text-slate-800">{data.label}</p>
      {data.lines.map((line, i) => (
        <p key={i} className="text-xs text-slate-500 truncate">{line}</p>
      ))}
      <Handle type="target" position={Position.Top} className="!bg-slate-300" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-300" />
    </div>
  )
}

export const nodeTypes = {
  trigger: TriggerNode,
  group: GroupNode,
  action: ActionNode,
} as any
