"""[KAN_FLOW2] Serialise a pipeline flowchart into compact, readable text.

The chart drawn in KAN_FLOW1 (stage nodes, decision diamonds, start/end pills and
labelled arrows) is turned into a handful of ``A -> B`` lines so Yip (the in app
assistant) can reason about how THIS tenant's Kanban pipeline actually works.

Pure — no DB. The caller resolves stage ids to live names (the board is the
source of truth) and passes them in as ``stage_names``. Deterministic ordering,
orphan nodes skipped, and the whole thing is length capped so it stays token
light in the system prompt.
"""
from __future__ import annotations

import uuid

from app.modules.pipeline.schemas import FlowchartGraph, FlowchartNode

# Keep the serialised chart bounded so it never dominates the prompt. We cap the
# number of rendered lines and the total character count; anything past the cap is
# dropped with a short note so the model knows the picture is partial.
_MAX_LINES = 60
_MAX_CHARS = 2000


def _node_label(node: FlowchartNode, stage_names: dict[uuid.UUID, str]) -> str:
    """Human label for a node, used inside a rendered line.

    Stage nodes resolve to their LIVE board name; decisions render as a bracketed
    question; start/end pills render as their caption or a default word.
    """
    if node.type == "stage":
        name = stage_names.get(node.stage_id) if node.stage_id else None
        return name or (node.label or "Unknown stage")
    if node.type == "decision":
        question = (node.label or "").strip() or "Question?"
        return f"[{question}]"
    if node.type == "start":
        return (node.label or "").strip() or "Start"
    if node.type == "end":
        return (node.label or "").strip() or "End"
    return node.label or node.type


def flowchart_to_text(
    graph: FlowchartGraph, stage_names: dict[uuid.UUID, str]
) -> str:
    """Render the graph as compact ``source -> target`` lines.

    Example output::

        New lead -> [Replied?]
        [Replied?] yes -> Qualified
        [Replied?] no (no reply after 5 days) -> Cold

    Rules:
      * only edges whose endpoints both exist are rendered (orphan/dangling nodes
        and any node with no edges are skipped — they carry no flow meaning);
      * an edge label is appended: a bare ``yes``/``no`` sits right after the
        arrow's source diamond, any other label is shown in parentheses;
      * ordering is deterministic (sorted by rendered text) so the same chart
        always serialises identically — stable for prompt caching;
      * output is capped in both line count and characters.

    Returns an empty string when there is nothing meaningful to say (no edges).
    """
    nodes_by_id = {n.id: n for n in graph.nodes}

    rendered: list[str] = []
    for edge in graph.edges:
        source = nodes_by_id.get(edge.source)
        target = nodes_by_id.get(edge.target)
        if source is None or target is None:
            continue  # dangling edge — skip
        src = _node_label(source, stage_names)
        tgt = _node_label(target, stage_names)
        label = (edge.label or "").strip()
        if label.lower() in ("yes", "no"):
            # e.g. "[Replied?] yes -> Qualified"
            line = f"{src} {label.lower()} -> {tgt}"
        elif label:
            # e.g. "New lead (no reply after 5 days) -> Cold"
            line = f"{src} -> {tgt} ({label})"
        else:
            line = f"{src} -> {tgt}"
        rendered.append(line)

    if not rendered:
        return ""

    # Deterministic ordering + de-duplication (a chart could carry two identical
    # arrows; the text only needs to state the relationship once).
    unique = sorted(set(rendered))

    lines: list[str] = []
    total = 0
    truncated = False
    for line in unique:
        if len(lines) >= _MAX_LINES or total + len(line) + 1 > _MAX_CHARS:
            truncated = True
            break
        lines.append(line)
        total += len(line) + 1

    if truncated:
        lines.append("… (pipeline chart truncated)")

    return "\n".join(lines)
