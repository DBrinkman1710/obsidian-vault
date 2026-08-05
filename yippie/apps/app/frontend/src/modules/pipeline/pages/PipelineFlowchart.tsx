// [KAN_FLOW1] Pipeline flowchart — the second Kanban view. Lets an admin lay out
// stage nodes, decision diamonds and labelled arrows so Yippie later understands
// how the pipeline works (semantic wiring is KAN_FLOW2). The board remains the
// source of truth for the stage list: adding a stage here creates a REAL stage
// via the existing endpoint, renaming/deleting a stage node PATCHes/DELETEs the
// real stage, and the server reconciles the graph against the live stages on
// every read/write. Node positions are manual — no auto-layout.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Background, Connection, Controls, Handle, MarkerType, Position, ReactFlow,
  ReactFlowProvider, addEdge, applyNodeChanges, useEdgesState, useNodesState,
  useReactFlow,
} from '@xyflow/react'
import type { EdgeChange, NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowRight, Circle, Diamond, Flag, GitBranch, Loader2, Plus, Save, Sparkles, Trash2, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { CloseButton } from '../../../shell/CloseButton'

const YIPPIE_BLUE = '#5BA4F5'

// ──────────────────────────────────────────────────────────────
// Types mirroring the backend FlowchartGraph / FlowchartOut schemas
// ──────────────────────────────────────────────────────────────
interface Stage {
  id: string
  name: string
  color: string
  display_order: number
  contact_count: number
}
type FlowNodeType = 'stage' | 'decision' | 'start' | 'end'
interface FlowNode {
  id: string
  type: FlowNodeType
  stage_id?: string | null
  label?: string | null
  x: number
  y: number
}
interface FlowEdge {
  id: string
  source: string
  target: string
  label?: string | null
}
interface FlowchartOut {
  graph: { nodes: FlowNode[]; edges: FlowEdge[] }
  unplaced_stages: Stage[]
}

// [KAN_FLOW2] A draft automation suggestion the backend derived from the chart's
// edges. Mirrors the FlowchartSuggestion schema.
interface FlowchartSuggestion {
  id: string
  title: string
  description: string
  condition_description: string | null
  source_stage_id: string
  source_stage_name: string
  target_stage_id: string
  target_stage_name: string
  trigger_type: string
  trigger_config: Record<string, any>
  conditions: { field: string; op: string; value: any }[]
}

// Random short id — never a hyphen (house rule), always node/edge unique.
function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

// ──────────────────────────────────────────────────────────────
// Custom nodes
// ──────────────────────────────────────────────────────────────
interface StageNodeData {
  name: string
  color: string
  stageId: string
  onRename: (stageId: string, name: string) => void
  onDelete: (stageId: string, name: string) => void
  canEdit: boolean
}

function StageNode({ data }: { data: StageNodeData }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(data.name)
  useEffect(() => setValue(data.name), [data.name])

  function commit() {
    setEditing(false)
    const next = value.trim()
    if (next && next !== data.name) data.onRename(data.stageId, next)
    else setValue(data.name)
  }

  return (
    <div
      className="group rounded-2xl border-2 bg-white shadow-sm px-4 py-3 min-w-[160px]"
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-300" />
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: data.color }} />
        {editing && data.canEdit ? (
          <input
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(data.name); setEditing(false) } }}
            className="flex-1 min-w-0 text-sm font-semibold text-slate-800 border border-slate-200 rounded px-1 focus:outline-none focus:ring-2 focus:ring-yippie/30"
          />
        ) : (
          <p
            className="flex-1 min-w-0 text-sm font-semibold text-slate-800 truncate cursor-text"
            onDoubleClick={() => data.canEdit && setEditing(true)}
            title={data.canEdit ? 'Double click to rename this stage' : data.name}
          >
            {data.name}
          </p>
        )}
        {data.canEdit && !editing && (
          <button
            onClick={() => data.onDelete(data.stageId, data.name)}
            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-danger-500 rounded transition-all"
            title="Delete stage"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-300" />
    </div>
  )
}

interface DecisionNodeData {
  label: string
  onLabel: (id: string, label: string) => void
  nodeId: string
  canEdit: boolean
}

function DecisionNode({ data }: { data: DecisionNodeData }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(data.label)
  useEffect(() => setValue(data.label), [data.label])

  function commit() {
    setEditing(false)
    data.onLabel(data.nodeId, value.trim())
  }

  // A diamond drawn as a rotated square; content is counter-rotated upright.
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      <div
        className="absolute inset-4 rotate-45 rounded-lg border-2 bg-violet-50"
        style={{ borderColor: '#8b5cf6' }}
      />
      <Handle type="target" position={Position.Top} className="!bg-violet-400" />
      <div className="relative z-10 px-3 text-center">
        {editing && data.canEdit ? (
          <textarea
            autoFocus
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Escape') { setValue(data.label); setEditing(false) } }}
            rows={2}
            className="w-24 text-xs text-center text-violet-800 bg-white/80 border border-violet-200 rounded px-1 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        ) : (
          <p
            className="text-xs font-semibold text-violet-800 cursor-text break-words"
            onDoubleClick={() => data.canEdit && setEditing(true)}
            title={data.canEdit ? 'Double click to edit the question' : undefined}
          >
            {data.label || 'Question?'}
          </p>
        )}
      </div>
      {/* Two labelled source handles — yes (bottom-left) / no (bottom-right). */}
      <Handle id="yes" type="source" position={Position.Bottom} style={{ left: '30%' }} className="!bg-success-500" />
      <Handle id="no" type="source" position={Position.Bottom} style={{ left: '70%' }} className="!bg-danger-500" />
      <span className="absolute bottom-1 left-[22%] text-[9px] font-bold text-success-600">yes</span>
      <span className="absolute bottom-1 left-[64%] text-[9px] font-bold text-danger-500">no</span>
    </div>
  )
}

function PillNode({ data }: { data: { kind: 'start' | 'end'; label?: string | null } }) {
  const isStart = data.kind === 'start'
  return (
    <div
      className={`rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ${
        isStart ? 'bg-slate-800 text-white' : 'bg-white border-2 border-slate-300 text-slate-600'
      }`}
    >
      {isStart
        ? <Handle type="source" position={Position.Right} className="!bg-slate-400" />
        : <Handle type="target" position={Position.Left} className="!bg-slate-400" />}
      {data.label || (isStart ? 'Start' : 'End')}
    </div>
  )
}

const nodeTypes = {
  stage: StageNode,
  decision: DecisionNode,
  start: PillNode,
  end: PillNode,
} as any

// ──────────────────────────────────────────────────────────────
// Delete-stage confirm modal — same size/shape as other Yippie modals
// ──────────────────────────────────────────────────────────────
function DeleteStageModal({
  name, onConfirm, onClose,
}: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-900">Delete stage</h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            Delete the <span className="font-semibold text-slate-800">{name}</span> stage? This removes
            it from the board, its cards lose this stage, and its node disappears from the flowchart. This
            cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} className="btn-secondary px-4 py-2">Cancel</button>
          <button
            onClick={onConfirm}
            className="btn-danger px-4 py-2"
          >
            Delete stage
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// [KAN_FLOW2] Suggest automations — modal fed by GET /pipeline/flowchart/suggestions
// Same size/shape as the other Yippie modals in this file.
// ──────────────────────────────────────────────────────────────
function SuggestAutomationsModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

  const { data: suggestions = [], isLoading } = useQuery<FlowchartSuggestion[]>({
    queryKey: ['pipeline-flowchart-suggestions'],
    queryFn: () => api.get('/pipeline/flowchart/suggestions').then((r: any) => r.data),
  })

  // Reuse the Flows builder's existing entry path: deep-link to /flows with a
  // prefill in router state. FlowsPage opens its BuilderModal seeded with it —
  // no parallel flow-creation mechanism.
  function createInFlows(s: FlowchartSuggestion) {
    navigate('/flows', {
      state: {
        flowPrefill: {
          name: `${s.source_stage_name} → ${s.target_stage_name}`,
          trigger_type: s.trigger_type,
          trigger_config: s.trigger_config,
          conditions: s.conditions,
          actions: [{ type: 'move_pipeline_stage', config: { stage_id: s.target_stage_id } }],
        },
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles size={15} style={{ color: YIPPIE_BLUE }} /> Suggested automations
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <div className="px-6 py-5 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin" style={{ color: YIPPIE_BLUE }} />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Zap size={20} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">Nothing to suggest yet</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Draw arrows between your stages (directly, or through a decision) and Yippie will
                suggest automations that move contacts along for you.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Turn the arrows you drew into automations. Each opens in Flows prefilled — review and
                enable it there.
              </p>
              {suggestions.map(s => (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-slate-700">{s.source_stage_name}</span>
                    <ArrowRight size={13} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-700">{s.target_stage_name}</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{s.description}</p>
                  <button
                    onClick={() => createInFlows(s)}
                    className="flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-opacity"
                    style={{ color: YIPPIE_BLUE }}
                  >
                    <Zap size={12} /> Create in Flows
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
          <button onClick={onClose} className="btn-secondary px-4 py-2">Close</button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Main flowchart tab
// ──────────────────────────────────────────────────────────────
export default function PipelineFlowchart({ canEdit }: { canEdit: boolean }) {
  return (
    <ReactFlowProvider>
      <FlowchartInner canEdit={canEdit} />
    </ReactFlowProvider>
  )
}

function FlowchartInner({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const { screenToFlowPosition } = useReactFlow()

  const [rfNodes, setRfNodes] = useNodesState<any>([])
  const [rfEdges, setRfEdges] = useEdgesState<any>([])
  const [pendingDelete, setPendingDelete] = useState<{ stageId: string; name: string } | null>(null)
  const [editingEdge, setEditingEdge] = useState<{ id: string; label: string } | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false) // [KAN_FLOW2]
  const hydrated = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: chart, isLoading } = useQuery<FlowchartOut>({
    queryKey: ['pipeline-flowchart'],
    queryFn: () => api.get('/pipeline/flowchart').then((r: any) => r.data),
  })

  // ── stage CRUD goes through the EXISTING pipeline endpoints (no duplication) ──
  const renameStageMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch(`/pipeline/stages/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages'] })
      qc.invalidateQueries({ queryKey: ['pipeline-board'] })
      qc.invalidateQueries({ queryKey: ['pipeline-flowchart'] })
    },
    onError: () => toast.error('Could not rename stage'),
  })
  const deleteStageMut = useMutation({
    mutationFn: (id: string) => api.delete(`/pipeline/stages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages'] })
      qc.invalidateQueries({ queryKey: ['pipeline-board'] })
      qc.invalidateQueries({ queryKey: ['pipeline-flowchart'] })
    },
    onError: () => toast.error('Could not delete stage'),
  })
  const createStageMut = useMutation({
    mutationFn: (name: string) =>
      api.post('/pipeline/stages', { name, color: YIPPIE_BLUE }).then((r: any) => r.data as Stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-stages'] })
      qc.invalidateQueries({ queryKey: ['pipeline-board'] })
    },
    onError: () => toast.error('Could not create stage'),
  })

  // Persist the whole graph. Reconciliation happens server side; we refresh the
  // unplaced tray from the response.
  const saveMut = useMutation({
    mutationFn: (graph: { nodes: FlowNode[]; edges: FlowEdge[] }) =>
      api.put('/pipeline/flowchart', graph).then((r: any) => r.data as FlowchartOut),
    onSuccess: (out) => qc.setQueryData(['pipeline-flowchart'], out),
    onError: () => toast.error('Could not save the flowchart'),
  })

  // ── stage-node callbacks (stable refs so node data stays comparable) ──
  const handleRename = useCallback((stageId: string, name: string) => {
    renameStageMut.mutate({ id: stageId, name })
    setRfNodes(nds => nds.map(n => (n.data?.stageId === stageId ? { ...n, data: { ...n.data, name } } : n)))
  }, [renameStageMut, setRfNodes])

  const handleDeleteRequest = useCallback((stageId: string, name: string) => {
    setPendingDelete({ stageId, name })
  }, [])

  // Build an RF node from a stored FlowNode.
  const toRfNode = useCallback((n: FlowNode, stageMeta?: { name: string; color: string }) => {
    const base = { id: n.id, position: { x: n.x, y: n.y } }
    if (n.type === 'stage') {
      return {
        ...base,
        type: 'stage',
        data: {
          name: stageMeta?.name ?? n.label ?? 'Stage',
          color: stageMeta?.color ?? YIPPIE_BLUE,
          stageId: n.stage_id!,
          onRename: handleRename,
          onDelete: handleDeleteRequest,
          canEdit,
        },
      }
    }
    if (n.type === 'decision') {
      return {
        ...base,
        type: 'decision',
        data: { label: n.label ?? '', nodeId: n.id, canEdit, onLabel: handleLabelDecision },
      }
    }
    return { ...base, type: n.type, data: { kind: n.type, label: n.label } }
  }, [canEdit, handleRename, handleDeleteRequest]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLabelDecision = useCallback((id: string, label: string) => {
    setRfNodes(nds => nds.map(n => (n.id === id ? { ...n, data: { ...n.data, label } } : n)))
    scheduleSave()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── hydrate RF state once from the server, then reconcile stage names/colours ──
  useEffect(() => {
    if (!chart) return
    // Placed stages: pull their name/colour from the board via the graph's own
    // stage nodes — but the server only returns unplaced stage metadata, so we
    // fetch the full stage list for placed-node labels.
    setRfNodes(chart.graph.nodes.map(n => toRfNode(n, undefined)))
    setRfEdges(chart.graph.edges.map(e => rfEdge(e)))
    hydrated.current = true
  }, [chart]) // eslint-disable-line react-hooks/exhaustive-deps

  // Placed stage nodes need their live name/colour. The board query has them.
  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages').then((r: any) => r.data),
  })
  const stageMeta = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>()
    for (const s of stages) m.set(s.id, { name: s.name, color: s.color })
    return m
  }, [stages])
  useEffect(() => {
    if (!hydrated.current) return
    setRfNodes(nds => nds.map(n => {
      if (n.type !== 'stage') return n
      const meta = stageMeta.get(n.data?.stageId)
      return meta ? { ...n, data: { ...n.data, name: meta.name, color: meta.color } } : n
    }))
  }, [stageMeta, setRfNodes])

  function rfEdge(e: FlowEdge) {
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label ?? undefined,
      markerEnd: { type: MarkerType.ArrowClosed },
    }
  }

  // ── serialise current RF state back to the graph schema ──
  const serialise = useCallback((): { nodes: FlowNode[]; edges: FlowEdge[] } => {
    const nodes: FlowNode[] = rfNodes.map((n: any) => ({
      id: n.id,
      type: n.type as FlowNodeType,
      stage_id: n.type === 'stage' ? n.data.stageId : null,
      label: n.type === 'decision' ? (n.data.label ?? '')
        : n.type === 'stage' ? null
        : (n.data.label ?? null),
      x: n.position.x,
      y: n.position.y,
    }))
    const edges: FlowEdge[] = rfEdges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === 'string' ? e.label : null,
    }))
    return { nodes, edges }
  }, [rfNodes, rfEdges])

  // ── debounced autosave ──
  const scheduleSave = useCallback(() => {
    if (!canEdit) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveMut.mutate(serialise()), 800)
  }, [canEdit, saveMut, serialise])
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // ── canvas interactions ──
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setRfNodes(nds => applyNodeChanges(changes, nds))
    if (changes.some(c => c.type === 'position' && !(c as any).dragging)) scheduleSave()
  }, [setRfNodes, scheduleSave])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges(eds => {
      const next = eds.filter(e => !changes.some(c => c.type === 'remove' && (c as any).id === e.id))
      return next
    })
    if (changes.some(c => c.type === 'remove')) scheduleSave()
  }, [setRfEdges, scheduleSave])

  const onConnect = useCallback((conn: Connection) => {
    if (!canEdit) return
    // Edges from a decision handle default their label to the handle (yes/no).
    const label = conn.sourceHandle === 'yes' ? 'yes' : conn.sourceHandle === 'no' ? 'no' : undefined
    setRfEdges(eds => addEdge({
      ...conn,
      id: newId('e'),
      label,
      markerEnd: { type: MarkerType.ArrowClosed },
    } as any, eds))
    scheduleSave()
  }, [canEdit, setRfEdges, scheduleSave])

  // ── toolbar actions ──
  function addDecision() {
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const id = newId('d')
    setRfNodes(nds => [...nds, {
      id, type: 'decision', position: pos,
      data: { label: '', nodeId: id, canEdit, onLabel: handleLabelDecision },
    }])
    scheduleSave()
  }
  function addPill(kind: 'start' | 'end') {
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    setRfNodes(nds => [...nds, {
      id: newId(kind), type: kind, position: pos, data: { kind },
    }])
    scheduleSave()
  }

  async function addStage() {
    const name = window.prompt('Name the new stage')
    if (!name?.trim()) return
    const stage = await createStageMut.mutateAsync(name.trim())
    const pos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    setRfNodes(nds => [...nds, {
      id: newId('n'), type: 'stage', position: pos,
      data: { name: stage.name, color: stage.color, stageId: stage.id, onRename: handleRename, onDelete: handleDeleteRequest, canEdit },
    }])
    scheduleSave()
  }

  // Drop an unplaced stage from the tray onto the canvas.
  function placeStage(stage: Stage, clientX: number, clientY: number) {
    const pos = screenToFlowPosition({ x: clientX, y: clientY })
    setRfNodes(nds => [...nds, {
      id: newId('n'), type: 'stage', position: pos,
      data: { name: stage.name, color: stage.color, stageId: stage.id, onRename: handleRename, onDelete: handleDeleteRequest, canEdit },
    }])
    scheduleSave()
  }

  // "Start from your stages": lay every stage out left→right, plain arrows between.
  function seedFromStages() {
    const list = [...stages].sort((a, b) => a.display_order - b.display_order)
    const nodes = list.map((s, i) => ({
      id: newId('n'), type: 'stage', position: { x: 60 + i * 240, y: 160 },
      data: { name: s.name, color: s.color, stageId: s.id, onRename: handleRename, onDelete: handleDeleteRequest, canEdit },
    }))
    const edges = nodes.slice(1).map((n, i) => ({
      id: newId('e'), source: nodes[i].id, target: n.id,
      markerEnd: { type: MarkerType.ArrowClosed },
    }))
    setRfNodes(nodes as any)
    setRfEdges(edges as any)
    scheduleSave()
  }

  function confirmDelete() {
    if (!pendingDelete) return
    deleteStageMut.mutate(pendingDelete.stageId)
    setRfNodes(nds => nds.filter(n => n.data?.stageId !== pendingDelete.stageId))
    setPendingDelete(null)
    scheduleSave()
  }

  function onEdgeClick(_: any, edge: any) {
    if (!canEdit) return
    setEditingEdge({ id: edge.id, label: typeof edge.label === 'string' ? edge.label : '' })
  }
  function commitEdgeLabel() {
    if (!editingEdge) return
    setRfEdges(eds => eds.map(e => (e.id === editingEdge.id ? { ...e, label: editingEdge.label || undefined } : e)))
    setEditingEdge(null)
    scheduleSave()
  }

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/kan-flow-stage')
    if (!raw) return
    let stage: Stage
    try { stage = JSON.parse(raw) } catch { return }
    placeStage(stage, e.clientX, e.clientY)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="text-blue-500 animate-spin" />
      </div>
    )
  }

  const unplaced = chart?.unplaced_stages ?? []
  const isEmpty = rfNodes.length === 0

  return (
    <>
      {pendingDelete && (
        <DeleteStageModal name={pendingDelete.name} onConfirm={confirmDelete} onClose={() => setPendingDelete(null)} />
      )}
      {showSuggestions && <SuggestAutomationsModal onClose={() => setShowSuggestions(false)} />}
      {editingEdge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-bold text-slate-900">Edit arrow label</h2>
              <CloseButton onClick={() => setEditingEdge(null)} />
            </div>
            <div className="px-6 py-5">
              <input
                autoFocus
                value={editingEdge.label}
                onChange={e => setEditingEdge({ ...editingEdge, label: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') commitEdgeLabel() }}
                placeholder="e.g. no reply after 5 days"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yippie/30 focus:border-yippie"
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50 shrink-0">
              <button onClick={() => setEditingEdge(null)} className="btn-secondary px-4 py-2">Cancel</button>
              <button onClick={commitEdgeLabel} className="btn-primary px-4 py-2">Save label</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-[calc(100vh-13rem)] gap-3">
        {/* Toolbar + unplaced tray */}
        {canEdit && (
          <div className="w-52 shrink-0 flex flex-col gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Add</p>
              <button onClick={addStage} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors">
                <Plus size={12} /> Stage
              </button>
              <button onClick={addDecision} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors">
                <Diamond size={12} /> Decision
              </button>
              <button onClick={() => addPill('start')} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors">
                <Circle size={12} /> Start
              </button>
              <button onClick={() => addPill('end')} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors">
                <Flag size={12} /> End
              </button>
            </div>

            {/* [KAN_FLOW2] Turn the drawn arrows into automations. Secondary
                style with the Yippie brand accent. */}
            <button
              onClick={() => setShowSuggestions(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border text-sm font-semibold rounded-xl transition-colors hover:bg-blue-50"
              style={{ borderColor: YIPPIE_BLUE, color: YIPPIE_BLUE }}
            >
              <Sparkles size={14} /> Suggest automations
            </button>

            <div className="rounded-xl border border-slate-200 bg-white p-3 flex-1 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Unplaced stages</p>
              {unplaced.length === 0 ? (
                <p className="text-xs text-slate-400">Every stage is on the canvas.</p>
              ) : (
                <div className="space-y-1.5">
                  {unplaced.map(s => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('application/kan-flow-stage', JSON.stringify(s)); e.dataTransfer.effectAllowed = 'copy' }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 cursor-grab active:cursor-grabbing hover:border-yippie/50"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => saveMut.mutate(serialise())}
              disabled={saveMut.isPending}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-yippie hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-opacity"
            >
              {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </button>
          </div>
        )}

        {/* Canvas */}
        <div
          className="flex-1 min-w-0 rounded-xl border border-slate-200 overflow-hidden relative"
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
        >
          {isEmpty && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center pointer-events-none">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <GitBranch size={24} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600 mb-1">Teach Yippie how your pipeline works</p>
              <p className="text-xs text-slate-400 max-w-sm mb-4 px-6">
                Lay out your stages, decisions and the arrows between them so Yippie understands how
                contacts should flow through the Kanban.
              </p>
              {canEdit && (
                <button
                  onClick={seedFromStages}
                  className="pointer-events-auto flex items-center gap-1.5 px-4 py-2 bg-yippie hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity"
                >
                  <GitBranch size={14} /> Start from your stages
                </button>
              )}
            </div>
          )}
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={onEdgeClick}
            nodesConnectable={canEdit}
            nodesDraggable={canEdit}
            fitView
            fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            deleteKeyCode={canEdit ? ['Backspace', 'Delete'] : null}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </>
  )
}
