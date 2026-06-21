#!/usr/bin/env python3
"""
Robust Alembic migration runner for Railway deployments.

Replaces bare `alembic upgrade heads` in the start command to catch the
"stale merge-parent" failure mode before any DDL runs.

That failure mode:
  1. A merge migration is created with down_revision = (A, B, C, D)
  2. Before it deploys, other pending migrations advance the head A → A'
  3. `alembic upgrade heads` runs A→A', then attempts the merge
  4. The merge's upgrade() succeeds, but Alembic's internal version update
     crashes with `KeyError: 'A'` because A is no longer in alembic_version
  5. The ENTIRE migration is rolled back (A→A' is kept; the merge is lost)
  6. The DB is left in a partial state, and redeploys keep failing

This script detects the mismatch before step 3 and exits with a clear
message telling the developer exactly which revision IDs to substitute in
the merge migration's down_revision.
"""
from __future__ import annotations

import os
import sys
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine

_ANCESTOR_CACHE: dict[str, frozenset[str]] = {}


def _ancestors(script: ScriptDirectory, rev_id: str) -> frozenset[str]:
    """Return all ancestor revision IDs (inclusive) of rev_id."""
    if rev_id not in _ANCESTOR_CACHE:
        result: set[str] = {rev_id}
        rev = script.get_revision(rev_id)
        if rev:
            for parent in rev._all_down_revisions or []:
                result |= _ancestors(script, parent)
        _ANCESTOR_CACHE[rev_id] = frozenset(result)
    return _ANCESTOR_CACHE[rev_id]


def _sync_url(url: str) -> str:
    return url.replace("+asyncpg", "")


def main() -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        sys.exit("[migrate] ERROR: DATABASE_URL is not set")

    cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(cfg)

    engine = create_engine(_sync_url(db_url))
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        db_heads = set(ctx.get_current_heads())
    engine.dispose()

    print(f"[migrate] Current DB heads: {sorted(db_heads) or ['<empty — fresh DB>']}")

    # --- Pre-flight: check every pending merge migration ---
    problems: list[str] = []

    # Full set of revision IDs already applied to the DB (heads + all their ancestors)
    db_history: frozenset[str] = (
        frozenset().union(*(_ancestors(script, h) for h in db_heads))
        if db_heads else frozenset()
    )

    for rev in script.get_revisions("heads"):
        if rev.revision in db_heads or not rev.is_merge_point:
            continue

        expected_parents = set(rev._all_down_revisions)

        # Fast path: all expected parents are current DB heads — OK
        if expected_parents.issubset(db_heads):
            continue

        missing = expected_parents - db_heads

        # Classify each missing parent
        stale: dict[str, list[str]] = {}   # parent → list of DB heads that supersede it
        bad: list[str] = []                 # parent unreachable from any DB head

        for p in missing:
            descendants_in_db = [h for h in db_heads if p in _ancestors(script, h)]
            if descendants_in_db:
                # DB head has already moved past p — stale reference
                stale[p] = descendants_in_db
            elif (_ancestors(script, p) - {p}).issubset(db_history):
                # All of p's ancestors are already in the DB — alembic can apply p
                # (covers linear descendants AND sibling migrations with shared parents)
                pass
            else:
                bad.append(p)

        lines = [
            f"\n  Merge migration : {rev.revision}",
            f"  File down_revision: {sorted(expected_parents)}",
            f"  Actual DB heads  : {sorted(db_heads)}",
        ]

        if stale:
            lines.append("  Stale parents (superseded — DB head has moved past them):")
            for p, descendants in stale.items():
                lines.append(f"    {p!r}  →  replace with  {descendants!r}")
            lines.append(
                f"\n  FIX: open migrations/versions/*{rev.revision}*.py and update"
                f" down_revision to replace the stale IDs above with their descendants."
            )

        if bad:
            lines.append(f"  MISSING parents (never applied — manual investigation needed): {bad}")

        if stale or bad:
            problems.append("\n".join(lines))

    if problems:
        print(
            "\n[migrate] ABORT — merge migration parent mismatch detected.\n"
            "  Pending migrations may have advanced the DB head past what the merge\n"
            "  migration expects. Fix the down_revision and redeploy.\n"
            + "\n".join(problems)
            + "\n",
            file=sys.stderr,
        )
        sys.exit(1)

    # --- All good: run migrations normally ---
    print("[migrate] Pre-flight OK — running alembic upgrade heads")
    command.upgrade(cfg, "heads")
    print("[migrate] Done.")


if __name__ == "__main__":
    main()
