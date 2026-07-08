"""[FLOW4] Pure graph arithmetic for branched flows — DB-free and unit-testable.

Phase 4 generalizes a flow's ``actions`` from a linear list into a small DAG:

    {"nodes": [{"id", "type", "config"}, ...],
     "edges": [{"from", "to", "when": "match"|"else"|None}, ...]}

A ``branch`` node holds OR-of-AND condition groups in ``config["conditions"]``
(the exact shape flow-level conditions use) and routes the run down its
``match`` or ``else`` edge. Every other node keeps at most one outgoing edge.

The no-migration trick from [FLOW2B] applies: a legacy linear list is one chain
via :func:`as_graph`, so nothing stored ever needs rewriting. Legacy actions
saved before [FLOW3] may lack ids — the chain normalizer mints a positional
``pos:N`` id for edge wiring only. ``pos:`` contains a colon, which the real id
pattern (``^[A-Za-z0-9_]{1,36}$``) can never produce, so synthetic ids are
recognisable and are never stamped into run results (see
:func:`result_action_id`).

The engine (engine.py) owns sessions and side effects; this module owns the
graph: normalization, structural validation (single root, acyclic, ≤ 25 nodes,
branch edge discipline) and the graph-aware wait math ([FLOW4] amendment —
waits are summed along the LONGEST root-to-leaf path, not a flat list).
"""
from __future__ import annotations

from typing import Any, Optional

from app.modules.flows import steps

MAX_NODES = 25
BRANCH_WHENS = ("match", "else")
_SYNTHETIC_PREFIX = "pos:"


def is_graph(actions: Any) -> bool:
    """Whether a stored ``actions`` value is the [FLOW4] graph shape (a dict)
    rather than the legacy/linear list."""
    return isinstance(actions, dict)


def as_graph(actions: Any) -> dict:
    """Normalize either stored shape to {"nodes", "edges"}. A linear list
    becomes a single chain (edges in list order, ``when`` None); an action
    without an id gets a synthetic ``pos:N`` id for wiring only."""
    if is_graph(actions):
        return {"nodes": actions.get("nodes") or [], "edges": actions.get("edges") or []}
    acts = list(actions or [])
    nodes: list[dict] = []
    ids: list[str] = []
    for i, action in enumerate(acts):
        node_id = action.get("id") or f"{_SYNTHETIC_PREFIX}{i}"
        ids.append(node_id)
        nodes.append(action if action.get("id") else {**action, "id": node_id})
    edges = [
        {"from": ids[i], "to": ids[i + 1], "when": None}
        for i in range(len(ids) - 1)
    ]
    return {"nodes": nodes, "edges": edges}


def result_action_id(node: dict) -> Optional[str]:
    """The id to stamp into a run result: the node's real id, or None for a
    synthetic chain id (legacy pre-[FLOW3] actions — replay falls back to list
    position for those, and a minted id would break that fallback)."""
    node_id = node.get("id")
    if not node_id or str(node_id).startswith(_SYNTHETIC_PREFIX):
        return None
    return node_id


def node_map(graph: dict) -> dict[str, dict]:
    return {n["id"]: n for n in graph.get("nodes") or []}


def out_edges(graph: dict, node_id: str) -> list[dict]:
    return [e for e in graph.get("edges") or [] if e.get("from") == node_id]


def root_id(graph: dict) -> Optional[str]:
    """The single node with no incoming edge (validated graphs have exactly
    one). None for an empty graph."""
    nodes = graph.get("nodes") or []
    if not nodes:
        return None
    targets = {e.get("to") for e in graph.get("edges") or []}
    for node in nodes:
        if node["id"] not in targets:
            return node["id"]
    return None


def next_id(graph: dict, node_id: str, matched: Optional[bool] = None) -> Optional[str]:
    """The node to walk to after ``node_id``. For a branch node pass the
    evaluation outcome — ``matched`` picks the ``match`` edge, otherwise the
    ``else`` edge (either may be absent: the flow simply ends)."""
    edges = out_edges(graph, node_id)
    if matched is None:
        return edges[0]["to"] if edges else None
    wanted = "match" if matched else "else"
    for edge in edges:
        if edge.get("when") == wanted:
            return edge["to"]
    return None


def iter_action_nodes(actions: Any) -> list[dict]:
    """Every executable node (everything except ``branch``) in either stored
    shape — what module/config completeness validation iterates over."""
    return [n for n in as_graph(actions)["nodes"] if n.get("type") != "branch"]


def validate_graph(graph: dict) -> None:
    """Structural validation for the graph shape ([FLOW4] spec): ≤ 25 nodes,
    unique ids, edges reference real nodes, exactly one root, acyclic, and
    branch edge discipline (branch → at most one ``match`` + one ``else``,
    at least one of them; other nodes → at most one unlabelled edge).
    Raises ValueError (→ 422 at the API layer)."""
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    if not nodes:
        raise ValueError("A flow graph needs at least one node")
    if len(nodes) > MAX_NODES:
        raise ValueError(f"A flow may have at most {MAX_NODES} steps")

    ids = [n.get("id") for n in nodes]
    if len(set(ids)) != len(ids):
        raise ValueError("Every step needs a unique id")
    by_id = {n["id"]: n for n in nodes}

    outgoing: dict[str, list[dict]] = {i: [] for i in ids}
    incoming: dict[str, int] = {i: 0 for i in ids}
    for edge in edges:
        source, target = edge.get("from"), edge.get("to")
        if source not in by_id or target not in by_id:
            raise ValueError("An edge references a step that doesn't exist")
        if source == target:
            raise ValueError("A step can't connect to itself")
        outgoing[source].append(edge)
        incoming[target] += 1

    roots = [i for i in ids if incoming[i] == 0]
    if len(roots) != 1:
        raise ValueError("A flow graph needs exactly one starting step")

    for node_id, node_edges in outgoing.items():
        if by_id[node_id].get("type") == "branch":
            whens = [e.get("when") for e in node_edges]
            if any(w not in BRANCH_WHENS for w in whens):
                raise ValueError("Branch edges must be labelled 'match' or 'else'")
            if whens.count("match") > 1 or whens.count("else") > 1:
                raise ValueError("A branch may have one 'match' and one 'else' path")
            if not node_edges:
                raise ValueError("A branch needs at least one outgoing path")
        else:
            if len(node_edges) > 1:
                raise ValueError("Only a branch step may have multiple outgoing paths")
            if node_edges and node_edges[0].get("when") is not None:
                raise ValueError("Only branch edges may carry a 'match'/'else' label")

    # Acyclic: Kahn's algorithm — with the single-root rule this also implies
    # every node is reachable from the root.
    indegree = dict(incoming)
    queue = [i for i in ids if indegree[i] == 0]
    seen = 0
    while queue:
        current = queue.pop()
        seen += 1
        for edge in outgoing[current]:
            indegree[edge["to"]] -= 1
            if indegree[edge["to"]] == 0:
                queue.append(edge["to"])
    if seen != len(ids):
        raise ValueError("A flow graph may not contain cycles")


def total_wait_days(actions: Any) -> float:
    """The wait total that counts against the 30-day cap: the LONGEST
    root-to-leaf wait sum ([FLOW4] amendment — a linear list's longest path is
    the whole list, so this matches the phase 2 behaviour exactly)."""
    graph = as_graph(actions)
    by_id = node_map(graph)
    memo: dict[str, float] = {}

    def walk(node_id: str) -> float:
        if node_id in memo:
            return memo[node_id]
        node = by_id[node_id]
        own = (
            steps.wait_delta(node.get("config") or {}).total_seconds() / 86400
            if node.get("type") == "wait" else 0.0
        )
        tails = [walk(e["to"]) for e in out_edges(graph, node_id)]
        memo[node_id] = own + (max(tails) if tails else 0.0)
        return memo[node_id]

    start = root_id(graph)
    return walk(start) if start else 0.0


def validate_wait_placement(actions: Any) -> None:
    """Graph-aware version of steps.validate_wait_placement: no path may END on
    a wait (nothing left to do afterwards) and the longest wait path may not
    exceed 30 days. Works on either stored shape. Raises ValueError."""
    graph = as_graph(actions)
    for node in graph.get("nodes") or []:
        if node.get("type") == "wait" and not out_edges(graph, node["id"]):
            raise ValueError("A flow can't end on a wait — add an action after it")
    if total_wait_days(actions) > 30:
        raise ValueError("The total wait across a flow may not exceed 30 days")
