// [FLOW3] Visual flow canvas at /flows/:id — the node view of one flow, with an
// inspector for edit parity (writes the exact same flows JSON as the modal
// builder) and run replay (highlights the path a historical run took).
// [FLOW4] the canvas is the editing surface for branches: the draft holds a
// step TREE (branch steps carry their match/else legs inline) that serializes
// to the graph shape — or back to the plain linear list while branch-free, so
// the modal builder stays usable until a branch is added.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Background, Controls, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, GitBranch, History, Plus, SlidersHorizontal, Trash2, X, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import {
  Condition, Flow, FlowRun, FlowsMeta, RUN_BADGE, Step, WEEKDAYS, apiError,
  canAppend, findStep, graphToTree, groupTriggers, newActionId, toGroups, treeToActions,
} from '../lib'
import { ConditionRow, ConfigField, WaitConfig } from '../components/FieldInputs'
import { nodeTypes } from './nodes'
import { FlowDraft, Selection, buildGraph } from './layout'
import { ReplayState, computeReplay } from './replay'

function draftFrom(flow: Flow): FlowDraft | null {
  const steps = graphToTree(flow.actions)
  if (steps === null) return null // non-tree DAG — only possible via the raw API
  return {
    name: flow.name,
    trigger_type: flow.trigger_type,
    trigger_config:
      flow.trigger_config && Object.keys(flow.trigger_config).length
        ? flow.trigger_config
        : { frequency: 'daily', time: '09:00' },
    groups: toGroups(flow.conditions).map(g => g.map(c => ({ ...c }))),
    steps,
    enabled: flow.enabled,
  }
}

function cleanGroups(groups: Condition[][]): Condition[][] {
  return groups
    .map(g => g
      .filter(c => c.field && c.op)
      .map(c => ({
        ...c,
        value: c.op === 'in' && typeof c.value === 'string'
          ? c.value.split(',').map(v => v.trim()).filter(Boolean)
          : c.value,
      })))
    .filter(g => g.length > 0)
}

function cleanSteps(steps: Step[]): Step[] {
  return steps.map(s => (s.type === 'branch'
    ? {
        ...s,
        config: { conditions: cleanGroups((s.config?.conditions as Condition[][]) ?? []) },
        match: cleanSteps(s.match ?? []),
        else: cleanSteps(s.else ?? []),
      }
    : s))
}

// The exact same request body the modal builder sends (edit parity) — except
// `actions` becomes the graph shape once the tree contains a branch.
function saveBody(draft: FlowDraft): object {
  return {
    name: draft.name.trim(),
    trigger_type: draft.trigger_type,
    trigger_config: {
      ...(draft.trigger_type === 'schedule' ? draft.trigger_config : {}),
      // [FLOW6] the chaining opt-in rides along for every trigger type
      ...(draft.trigger_config.chainable ? { chainable: true } : {}),
    },
    conditions: cleanGroups(draft.groups),
    actions: treeToActions(cleanSteps(draft.steps)),
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
  const [unsupported, setUnsupported] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [replayRunId, setReplayRunId] = useState<string | null>(null)
  const [panel, setPanel] = useState<'inspect' | 'runs'>('inspect')
  const [error, setError] = useState('')

  // Initialize the draft once the flow arrives; never clobber unsaved edits.
  useEffect(() => {
    if (flow && draft === null && !unsupported) {
      const d = draftFrom(flow)
      if (d) setDraft(d)
      else setUnsupported(true)
    }
  }, [flow, draft, unsupported])

  const dirty = useMemo(
    () => !!flow && !!draft && JSON.stringify(draft) !== JSON.stringify(draftFrom(flow)),
    [flow, draft],
  )

  const replayRun = runs.find(r => r.id === replayRunId) ?? null
  const replay: ReplayState | null = useMemo(
    () => (replayRun && draft ? computeReplay(replayRun, draft.groups, draft.steps) : null),
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

  // --- flow-level condition group edits (unchanged from [FLOW3])
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

  // --- step tree edits ([FLOW4] — all on a cloned tree, then patched in)
  type LegTarget = { branchId: string; leg: 'match' | 'else' } | null

  function listFor(steps: Step[], target: LegTarget): Step[] | null {
    if (!target) return steps
    const loc = findStep(steps, target.branchId)
    if (!loc) return null
    const branch = loc.list[loc.index]
    if (!branch[target.leg]) branch[target.leg] = []
    return branch[target.leg]!
  }

  function addStep(target: LegTarget, kind: 'action' | 'branch') {
    const step: Step = kind === 'branch'
      ? {
          id: newActionId(), type: 'branch',
          config: { conditions: [[{ field: '', op: 'equals', value: '' }]] },
          match: [], else: [],
        }
      : { id: newActionId(), type: meta?.actions[0]?.key ?? 'notify_user', config: {} }
    const steps = structuredClone(draft!.steps)
    const list = listFor(steps, target)
    if (!list || !canAppend(list)) return
    list.push(step)
    patchDraft({ steps })
    setSelection({ kind: 'step', id: step.id })
  }

  function updateStep(stepId: string, patch: Partial<Step>) {
    const steps = structuredClone(draft!.steps)
    const loc = findStep(steps, stepId)
    if (!loc) return
    loc.list[loc.index] = { ...loc.list[loc.index], ...patch }
    patchDraft({ steps })
  }

  function removeStep(stepId: string) {
    const steps = structuredClone(draft!.steps)
    const loc = findStep(steps, stepId)
    if (!loc) return
    loc.list.splice(loc.index, 1)
    patchDraft({ steps })
    setSelection(null)
  }

  function moveStep(stepId: string, dir: -1 | 1) {
    const steps = structuredClone(draft!.steps)
    const loc = findStep(steps, stepId)
    if (!loc) return
    const to = loc.index + dir
    if (to < 0 || to >= loc.list.length) return
    ;[loc.list[loc.index], loc.list[to]] = [loc.list[to], loc.list[loc.index]]
    // a branch always ends its chain — block moves that would bury one
    if (loc.list.some((s, i) => s.type === 'branch' && i !== loc.list.length - 1)) return
    patchDraft({ steps })
  }

  function mutateBranchGroups(stepId: string, fn: (groups: Condition[][]) => Condition[][]) {
    const steps = structuredClone(draft!.steps)
    const loc = findStep(steps, stepId)
    if (!loc) return
    const step = loc.list[loc.index]
    const groups = fn(((step.config?.conditions as Condition[][]) ?? []).map(g => [...g]))
    step.config = { ...step.config, conditions: groups }
    patchDraft({ steps })
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
  if (unsupported) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">
          This flow's graph was created outside the builder in a shape the canvas can't display.
        </p>
        <button onClick={() => navigate('/flows')} className="mt-2 text-sm font-semibold text-blue-600">
          Back to flows
        </button>
      </div>
    )
  }
  if (!draft) return null

  const trigger = meta?.triggers.find(t => t.key === draft.trigger_type)
  const selectedLoc = selection?.kind === 'step' ? findStep(draft.steps, selection.id) : null
  const selectedStep = selectedLoc ? selectedLoc.list[selectedLoc.index] : null

  function legSection(step: Step, leg: 'match' | 'else') {
    const list = (leg === 'match' ? step.match : step.else) ?? []
    const label = leg === 'match' ? 'Yes path (conditions match)' : 'No path (otherwise)'
    return (
      <div className="space-y-1.5 pt-1">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        {list.length === 0 && <p className="text-xs text-slate-400">Flow ends here.</p>}
        {list.map(s => (
          <button
            key={s.id}
            onClick={() => setSelection({ kind: 'step', id: s.id })}
            className="block w-full text-left text-xs text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-slate-50 truncate"
          >
            {s.type === 'branch' ? 'Branch' : (meta?.actions.find(a => a.key === s.type)?.label ?? s.type)}
          </button>
        ))}
        {canAppend(list) ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => addStep({ branchId: step.id, leg }, 'action')}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              <Plus size={12} /> Action
            </button>
            <button
              onClick={() => addStep({ branchId: step.id, leg }, 'branch')}
              className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
            >
              <GitBranch size={12} /> Branch
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400">Select the nested branch to extend this path.</p>
        )}
      </div>
    )
  }

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
              if (node.id.startsWith('ghost-')) return
              setPanel('inspect')
              if (node.id === 'trigger') setSelection({ kind: 'trigger' })
              else if (node.id.startsWith('group-')) {
                setSelection({ kind: 'group', index: Number(node.id.split('-')[1]) })
              } else if (node.id.startsWith('step:')) {
                setSelection({ kind: 'step', id: node.id.slice('step:'.length) })
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
                {canAppend(draft.steps) ? (
                  <>
                    <button onClick={() => addStep(null, 'action')} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                      <Plus size={13} /> Add action
                    </button>
                    <button onClick={() => addStep(null, 'branch')} className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700">
                      <GitBranch size={13} /> Add branch (if/else)
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    This flow ends in a branch — select it to extend its paths.
                  </p>
                )}
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
                  {groupTriggers(meta.triggers).map(([group, triggers]) => (
                    <optgroup key={group} label={group}>
                      {triggers.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </optgroup>
                  ))}
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
                {/* [FLOW6] schedule/webhook events are never flow-caused, so the
                    opt-in only makes sense for mutation triggers */}
                {draft.trigger_type !== 'schedule' && draft.trigger_type !== 'webhook' && (
                  <label className="flex items-start gap-2 text-xs text-slate-500 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={!!draft.trigger_config.chainable}
                      onChange={e => patchDraft({
                        trigger_config: e.target.checked
                          ? { ...draft.trigger_config, chainable: true }
                          : Object.fromEntries(Object.entries(draft.trigger_config).filter(([k]) => k !== 'chainable')),
                      })}
                      className="accent-blue-600 mt-0.5"
                    />
                    Other flows may trigger this one (when their actions cause this event)
                  </label>
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

            {/* [FLOW4] branch step inspector */}
            {panel === 'inspect' && isAdmin && meta && selectedStep?.type === 'branch' && (
              <div className="space-y-2">
                <div className="flex items-center">
                  <p className="text-xs font-bold text-violet-500 uppercase tracking-wide flex items-center gap-1">
                    <GitBranch size={11} /> Branch
                  </p>
                  <button
                    onClick={() => removeStep(selectedStep.id)}
                    className="ml-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete branch (and both paths)"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Checked against the record's current data when the run gets here — after a wait,
                  "status is open" means still open.
                </p>
                {(((selectedStep.config?.conditions as Condition[][]) ?? [])).map((group, gi) => (
                  <div key={gi} className="space-y-1.5">
                    {gi > 0 && <p className="text-[10px] font-bold text-slate-400 text-center uppercase">or</p>}
                    {group.map((c, ci) => (
                      <ConditionRow
                        key={ci}
                        condition={c}
                        trigger={trigger}
                        meta={meta}
                        onChange={patch => mutateBranchGroups(selectedStep.id, gs => gs.map((g, gIdx) =>
                          gIdx === gi ? g.map((cc, cIdx) => (cIdx === ci ? { ...cc, ...patch } : cc)) : g))}
                        onRemove={() => mutateBranchGroups(selectedStep.id, gs => gs
                          .map((g, gIdx) => (gIdx === gi ? g.filter((_, cIdx) => cIdx !== ci) : g))
                          .filter(g => g.length > 0))}
                      />
                    ))}
                    <button
                      onClick={() => mutateBranchGroups(selectedStep.id, gs => gs.map((g, gIdx) =>
                        gIdx === gi ? [...g, { field: '', op: 'equals', value: '' }] : g))}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <Plus size={12} /> Add condition
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => mutateBranchGroups(selectedStep.id, gs =>
                    [...gs, [{ field: '', op: 'equals', value: '' }]])}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Plus size={13} /> Add OR group
                </button>
                {legSection(selectedStep, 'match')}
                {legSection(selectedStep, 'else')}
              </div>
            )}

            {/* action / wait step inspector */}
            {panel === 'inspect' && isAdmin && meta && selectedStep && selectedStep.type !== 'branch' && selectedLoc && (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    Step {selectedLoc.index + 1} of {selectedLoc.list.length}
                    {selectedLoc.parent ? ' (in branch)' : ''}
                  </p>
                  <button
                    onClick={() => moveStep(selectedStep.id, -1)}
                    disabled={selectedLoc.index === 0}
                    className="ml-auto px-1.5 py-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 text-xs"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStep(selectedStep.id, 1)}
                    disabled={selectedLoc.index >= selectedLoc.list.length - 1 ||
                      selectedLoc.list[selectedLoc.index + 1]?.type === 'branch'}
                    className="px-1.5 py-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 text-xs"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeStep(selectedStep.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                    title="Delete action"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <select
                  value={selectedStep.type}
                  onChange={e => updateStep(selectedStep.id, { type: e.target.value, config: {} })}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {meta.actions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
                {selectedStep.type === 'wait' ? (
                  <WaitConfig
                    config={selectedStep.config}
                    onChange={c => updateStep(selectedStep.id, { config: c })}
                  />
                ) : (
                  <div className="space-y-2">
                    {(meta.actions.find(m => m.key === selectedStep.type)?.config_fields ?? []).map(f => (
                      <ConfigField
                        key={f.key}
                        field={f}
                        value={selectedStep.config[f.key]}
                        meta={meta}
                        onChange={v => updateStep(selectedStep.id, {
                          config: { ...selectedStep.config, [f.key]: v },
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
