// [FLOW3] Visual flow canvas at /flows/:id — the node view of one flow, with an
// inspector for edit parity (writes the exact same flows JSON as the modal
// builder) and run replay (highlights the path a historical run took).
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, History, Plus, SlidersHorizontal, Trash2, X, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import {
  Action, Condition, Flow, FlowRun, FlowsMeta, RUN_BADGE, WEEKDAYS, apiError,
  newActionId, toGroups,
} from '../lib'
import { ConditionRow, ConfigField, WaitConfig } from '../components/FieldInputs'
import { nodeTypes } from './nodes'
import { FlowDraft, Selection, buildGraph } from './layout'
import { ReplayState, computeReplay } from './replay'

function draftFrom(flow: Flow): FlowDraft {
  return {
    name: flow.name,
    trigger_type: flow.trigger_type,
    trigger_config:
      flow.trigger_config && Object.keys(flow.trigger_config).length
        ? flow.trigger_config
        : { frequency: 'daily', time: '09:00' },
    groups: toGroups(flow.conditions).map(g => g.map(c => ({ ...c }))),
    actions: flow.actions.map(a => ({ ...a, config: { ...(a.config ?? {}) } })),
    enabled: flow.enabled,
  }
}

// The exact same request body the modal builder sends (edit parity).
function saveBody(draft: FlowDraft): object {
  const conditions = draft.groups
    .map(g => g
      .filter(c => c.field && c.op)
      .map(c => ({
        ...c,
        value: c.op === 'in' && typeof c.value === 'string'
          ? c.value.split(',').map(v => v.trim()).filter(Boolean)
          : c.value,
      })))
    .filter(g => g.length > 0)
  return {
    name: draft.name.trim(),
    trigger_type: draft.trigger_type,
    trigger_config: draft.trigger_type === 'schedule' ? draft.trigger_config : {},
    conditions,
    actions: draft.actions,
    enabled: draft.enabled,
  }
}

export default function FlowCanvasPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin'

  const { data: meta } = useQuery<FlowsMeta>({
    queryKey: ['flows-meta'],
    queryFn: () => api.get('/flows/meta').then((r: any) => r.data),
  })
  const { data: flows = [], isLoading } = useQuery<Flow[]>({
    queryKey: ['flows'],
    queryFn: () => api.get('/flows').then((r: any) => r.data),
  })
  const flow = flows.find(f => f.id === id)

  const { data: runs = [] } = useQuery<FlowRun[]>({
    queryKey: ['flow-runs', id],
    queryFn: () => api.get(`/flows/${id}/runs`).then((r: any) => r.data),
    enabled: !!id,
  })

  const [draft, setDraft] = useState<FlowDraft | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [replayRunId, setReplayRunId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'inspect' | 'runs'>('inspect')
  const [error, setError] = useState('')

  // Initialize the draft once the flow arrives; never clobber unsaved edits.
  useEffect(() => {
    if (flow && draft === null) setDraft(draftFrom(flow))
  }, [flow, draft])

  const dirty = useMemo(
    () => !!flow && !!draft && JSON.stringify(draft) !== JSON.stringify(draftFrom(flow)),
    [flow, draft],
  )

  const replayRun = runs.find(r => r.id === replayRunId) ?? null
  const replay: ReplayState | null = useMemo(
    () => (replayRun && draft ? computeReplay(replayRun, draft.groups, draft.actions) : null),
    [replayRun, draft],
  )

  const { nodes, edges } = useMemo(
    () => (draft ? buildGraph(draft, meta, replay, selection) : { nodes: [], edges: [] }),
    [draft, meta, replay, selection],
  )

  const saveMut = useMutation({
    mutationFn: () => api.patch(`/flows/${id}`, saveBody(draft!)),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['flows'] })
      setDraft(draftFrom(r.data))
      setError('')
      toast.success('Flow saved')
    },
    onError: (err: any) => setError(apiError(err)),
  })

  function patchDraft(patch: Partial<FlowDraft>) {
    setDraft(d => (d ? { ...d, ...patch } : d))
  }

  // --- inspector mutations (all pure draft-state edits)
  function setCondition(gi: number, ci: number, patch: Partial<Condition>) {
    patchDraft({
      groups: draft!.groups.map((g, gIdx) =>
        gIdx === gi ? g.map((c, cIdx) => (cIdx === ci ? { ...c, ...patch } : c)) : g),
    })
  }
  function addCondition(gi: number) {
    patchDraft({
      groups: draft!.groups.map((g, gIdx) =>
        gIdx === gi ? [...g, { field: '', op: 'equals', value: '' }] : g),
    })
  }
  function removeCondition(gi: number, ci: number) {
    const groups = draft!.groups
      .map((g, gIdx) => (gIdx === gi ? g.filter((_, cIdx) => cIdx !== ci) : g))
      .filter(g => g.length > 0)
    patchDraft({ groups })
    if (groups.length <= gi) setSelection(null)
  }
  function addGroup() {
    patchDraft({ groups: [...draft!.groups, [{ field: '', op: 'equals', value: '' }]] })
    setSelection({ kind: 'group', index: draft!.groups.length })
  }
  function removeGroup(gi: number) {
    patchDraft({ groups: draft!.groups.filter((_, i) => i !== gi) })
    setSelection(null)
  }
  function addAction() {
    const action: Action = { id: newActionId(), type: meta?.actions[0]?.key ?? 'notify_user', config: {} }
    patchDraft({ actions: [...draft!.actions, action] })
    setSelection({ kind: 'action', index: draft!.actions.length })
  }
  function updateAction(ai: number, patch: Partial<Action>) {
    patchDraft({
      actions: draft!.actions.map((a, i) => (i === ai ? { ...a, ...patch } : a)),
    })
  }
  function removeAction(ai: number) {
    patchDraft({ actions: draft!.actions.filter((_, i) => i !== ai) })
    setSelection(null)
  }
  function moveAction(ai: number, dir: -1 | 1) {
    const to = ai + dir
    if (to < 0 || to >= draft!.actions.length) return
    const actions = [...draft!.actions]
    ;[actions[ai], actions[to]] = [actions[to], actions[ai]]
    patchDraft({ actions })
    setSelection({ kind: 'action', index: to })
  }

  if (isLoading || (!flow && flows.length === 0)) {
    return <p className="p-8 text-sm text-slate-400">Loading…</p>
  }
  if (!flow) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">Flow not found.</p>
        <button onClick={() => navigate('/flows')} className="mt-2 text-sm font-semibold text-blue-600">
          Back to flows
        </button>
      </div>
    )
  }
  if (!draft) return null

  const trigger = meta?.triggers.find(t => t.key === draft.trigger_type)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <Link to="/flows" className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg" title="Back to flows">
          <ArrowLeft size={16} />
        </Link>
        <Zap size={16} className="text-slate-400 shrink-0" />
        {isAdmin ? (
          <input
            value={draft.name}
            onChange={e => patchDraft({ name: e.target.value })}
            className="text-sm font-semibold text-slate-900 border border-transparent hover:border-slate-200 focus:border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0 flex-1 max-w-md"
          />
        ) : (
          <p className="text-sm font-semibold text-slate-900 truncate">{draft.name}</p>
        )}
        {replayRun && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1">
            Replaying run from {new Date(replayRun.created_at).toLocaleString()}
            <button onClick={() => setReplayRunId(null)} className="text-slate-400 hover:text-slate-600" title="Stop replay">
              <X size={12} />
            </button>
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {error && <p className="text-xs text-red-500 max-w-xs truncate" title={error}>{error}</p>}
          {isAdmin && (
            <>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={e => patchDraft({ enabled: e.target.checked })}
                  className="accent-blue-600"
                />
                Enabled
              </label>
              <button
                onClick={() => saveMut.mutate()}
                disabled={!dirty || saveMut.isPending}
                className="px-4 py-2 bg-yippie text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Save flow
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* canvas */}
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            nodesConnectable={false}
            deleteKeyCode={null}
            onNodeClick={(_, node) => {
              setPanel('inspect')
              if (node.id === 'trigger') setSelection({ kind: 'trigger' })
              else {
                const [kind, index] = node.id.split('-')
                setSelection({ kind: kind as 'group' | 'action', index: Number(index) })
              }
            }}
            onPaneClick={() => setSelection(null)}
          >
            <Background gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        {/* side panel */}
        <div className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col min-h-0">
          <div className="flex border-b border-slate-100 shrink-0">
            <button
              onClick={() => setPanel('inspect')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold ${panel === 'inspect' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <SlidersHorizontal size={12} /> Inspect
            </button>
            <button
              onClick={() => setPanel('runs')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold ${panel === 'runs' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <History size={12} /> Runs
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {panel === 'runs' && (
              <>
                {runs.length === 0 && (
                  <p className="text-xs text-slate-400">No runs yet — the flow hasn't been triggered.</p>
                )}
                {runs.length > 0 && (
                  <p className="text-xs text-slate-400">Pick a run to replay its path on the canvas.</p>
                )}
                {runs.map(run => (
                  <button
                    key={run.id}
                    onClick={() => setReplayRunId(replayRunId === run.id ? null : run.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left ${replayRunId === run.id ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${RUN_BADGE[run.status] ?? RUN_BADGE.skipped}`}>
                      {run.status}
                    </span>
                    <span className="text-xs text-slate-500 truncate flex-1">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </button>
                ))}
              </>
            )}

            {panel === 'inspect' && !isAdmin && (
              <p className="text-xs text-slate-400">Only admins can edit flows. Pick a run under Runs to replay it.</p>
            )}

            {panel === 'inspect' && isAdmin && selection === null && (
              <>
                <p className="text-xs text-slate-400">Select a node to edit it, or add a step:</p>
                <button onClick={addAction} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                  <Plus size={13} /> Add action
                </button>
                <button onClick={addGroup} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                  <Plus size={13} /> Add {draft.groups.length === 0 ? 'condition' : 'OR group'}
                </button>
              </>
            )}

            {panel === 'inspect' && isAdmin && selection?.kind === 'trigger' && meta && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">When</p>
                <select
                  value={draft.trigger_type}
                  onChange={e => { patchDraft({ trigger_type: e.target.value, groups: [] }) }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {meta.triggers.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                {draft.trigger_type === 'schedule' && (
                  <div className="space-y-2 pt-1">
                    <select
                      value={draft.trigger_config.frequency ?? 'daily'}
                      onChange={e => {
                        const frequency = e.target.value
                        patchDraft({
                          trigger_config: frequency === 'weekly'
                            ? { ...draft.trigger_config, frequency, weekday: draft.trigger_config.weekday ?? 0 }
                            : { frequency, time: draft.trigger_config.time ?? '09:00' },
                        })
                      }}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="daily">Every day</option>
                      <option value="weekly">Every week</option>
                    </select>
                    {draft.trigger_config.frequency === 'weekly' && (
                      <select
                        value={String(draft.trigger_config.weekday ?? 0)}
                        onChange={e => patchDraft({ trigger_config: { ...draft.trigger_config, weekday: Number(e.target.value) } })}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                    )}
                    <input
                      type="time"
                      value={draft.trigger_config.time ?? '09:00'}
                      onChange={e => patchDraft({ trigger_config: { ...draft.trigger_config, time: e.target.value } })}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                )}
              </div>
            )}

            {panel === 'inspect' && isAdmin && selection?.kind === 'group' && meta && draft.groups[selection.index] && (
              <div className="space-y-2">
                <div className="flex items-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Condition group {selection.index + 1}
                  </p>
                  <button
                    onClick={() => removeGroup(selection.index)}
                    className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete group"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {draft.groups[selection.index].map((c, ci) => (
                  <ConditionRow
                    key={ci}
                    condition={c}
                    trigger={trigger}
                    meta={meta}
                    onChange={patch => setCondition(selection.index, ci, patch)}
                    onRemove={() => removeCondition(selection.index, ci)}
                  />
                ))}
                <button
                  onClick={() => addCondition(selection.index)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Plus size={13} /> Add condition
                </button>
              </div>
            )}

            {panel === 'inspect' && isAdmin && selection?.kind === 'action' && meta && draft.actions[selection.index] && (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Step {selection.index + 1} of {draft.actions.length}
                  </p>
                  <button
                    onClick={() => moveAction(selection.index, -1)}
                    disabled={selection.index === 0}
                    className="ml-auto px-1.5 py-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 text-xs"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveAction(selection.index, 1)}
                    disabled={selection.index === draft.actions.length - 1}
                    className="px-1.5 py-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 text-xs"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeAction(selection.index)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete action"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <select
                  value={draft.actions[selection.index].type}
                  onChange={e => updateAction(selection.index, { type: e.target.value, config: {} })}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {meta.actions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                {draft.actions[selection.index].type === 'wait' ? (
                  <WaitConfig
                    config={draft.actions[selection.index].config}
                    onChange={c => updateAction(selection.index, { config: c })}
                  />
                ) : (
                  <div className="space-y-2">
                    {(meta.actions.find(m => m.key === draft.actions[selection.index].type)?.config_fields ?? []).map(f => (
                      <ConfigField
                        key={f.key}
                        field={f}
                        value={draft.actions[selection.index].config[f.key]}
                        meta={meta}
                        onChange={v => updateAction(selection.index, {
                          config: { ...draft.actions[selection.index].config, [f.key]: v },
                        })}
                      />
                    ))}
                    <p className="text-xs text-slate-400">
                      Tip: use {'{subject}'}, {'{full_name}'} or {'{stage_name}'} in texts to insert event details.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
