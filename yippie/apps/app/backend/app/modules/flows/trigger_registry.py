"""[FLOW7] Per-module trigger registry.

Every module that emits flow events declares its triggers in a `flow_triggers.py`
next to its models/service. This registry discovers those files by a FILESYSTEM
scan and merges their `TRIGGERS` dicts into the single catalogue the builder + the
engine consume (conditions.TRIGGER_META).

Discovery is filesystem-based on purpose: iterating app.modules.MODULES would
import every module router and create an import cycle (a router imports its
service, which imports flow_events, which the engine imports…). Scanning for the
file and importing only `{pkg}.flow_triggers` keeps the dependency graph a DAG.
"""
from __future__ import annotations

import importlib
from pathlib import Path

_MODULES_DIR = Path(__file__).resolve().parent.parent

# Builder picker order — ticket_created MUST stay first (the modal + "New on
# canvas" default to triggers[0]). Any package discovered but not listed here is
# appended alphabetically.
_PREFERRED_ORDER = [
    "tickets", "contacts", "pipeline", "inbox", "chat", "booking",
    "marketing", "contracts", "billing", "shipments", "saas",
]


def _discover_packages() -> list[str]:
    """Module packages that ship a flow_triggers.py, in preferred order then any
    remaining ones alphabetically."""
    present = {
        child.name
        for child in _MODULES_DIR.iterdir()
        if child.is_dir() and (child / "flow_triggers.py").exists()
    }
    ordered = [pkg for pkg in _PREFERRED_ORDER if pkg in present]
    ordered += sorted(present - set(ordered))
    return ordered


def assemble_trigger_meta() -> dict[str, dict]:
    """Import each discovered `{pkg}.flow_triggers` and merge its TRIGGERS dict.
    Raises RuntimeError if two modules declare the same trigger key."""
    meta: dict[str, dict] = {}
    for pkg in _discover_packages():
        module = importlib.import_module(f"app.modules.{pkg}.flow_triggers")
        for key, decl in getattr(module, "TRIGGERS", {}).items():
            if key in meta:
                raise RuntimeError(
                    f"Duplicate flow trigger '{key}' declared in module '{pkg}'"
                )
            meta[key] = decl
    return meta
