# Session — Yippie dev session workflow

Use this skill to start a new dev session or end one correctly.

## Starting a session

1. Read `~/obsidian-vault/yippie/ROADMAP.md` — Tier sections list open work; the **Latest** header shows what just shipped.
2. Pick items by tier and use the matching model:
   - 🟣 Tier 1 (big/creative/architecture) → Opus
   - 🔵 Tier 2 (medium, well-scoped) → Sonnet
   - 🟢 Tier 3 (quick fixes, polish) → Haiku
3. **All work happens on the `sandbox` branch** from `~/obsidian-vault/yippie/` (devsandbox and commercial branches were retired 2026-06-20).
4. Parallel sessions: `./scripts/new-session.sh <label> "desc"` creates a worktree at `~/yippie-<label>/`; land with `./scripts/land-session.sh <label>`. Never run two flows sessions in parallel.

## Ending a session (mandatory — never skip)

1. Prepend a session summary to the **Latest:** header in `ROADMAP.md`.
2. Mark completed items ✅ in their tier section.
3. Before pushing any migration change: `cd apps/app/backend && python3 -m alembic heads` must print exactly ONE line.
4. Commit (NO hyphens in commit messages — spaces/underscores/em dashes) and `git push origin sandbox`, then check the Railway build for errors.
5. New frontend UI must pass `pnpm run check:ui` (design contract: `apps/app/frontend/DESIGN.md`).

## Branch/deploy reference

| Action | Command |
|---|---|
| Deploy everything (staging platform + marketing site) | `git push origin sandbox` |
| Promote to production | `git push origin sandbox:production` (only after verifying on sandbox) |
| Generate migration | `docker compose exec backend alembic revision --autogenerate -m "describe"` |
| Run migrations | `docker compose exec backend alembic upgrade head` |

Railway watch paths: `apps/app/**` → Sandbox env (sandbox.getyippie.com), `apps/web/**` → Commercial env (getyippie.com). A push touching only screenshots won't rebuild — bundle a src/ change.

## Item ID notation

Use stable `[ITEM-ID]` identifiers from the ROADMAP (e.g. `[FLOW8]`, `[UX-CRAFT]`).
✅ = done, `[ ]` = open, `[~]` = partially done.
