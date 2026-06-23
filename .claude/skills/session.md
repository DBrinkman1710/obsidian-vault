# Session — Yippie dev session workflow

Use this skill to start a new dev session or end one correctly.

## Starting a session

1. Read `ROADMAP.md` — look at the "▶ Next session" section for what to pick up.
2. Pick items by tier and use the matching model:
   - 🟣 Tier 1 (big/creative/architecture) → Opus
   - 🔵 Tier 2 (medium, well-scoped) → Sonnet
   - 🟢 Tier 3 (quick fixes, polish) → Haiku (current model is fine)
3. All feature work goes on `devsandbox` branch.

## Ending a session (mandatory — never skip)

1. Prepend a session summary to the `**Updated:**` header in `ROADMAP.md`.
2. Mark completed items as ✅ DONE in their tier section; remove from open/deferred lists if done.
3. Commit the ROADMAP update together with the feature code (single commit).
4. `git push origin devsandbox` to deploy to staging.

## Branch/deploy reference

| Action | Command |
|---|---|
| Deploy staging | `git push origin devsandbox` |
| Deploy marketing site | `git push origin commercial` |
| Generate migration | `docker compose exec backend alembic revision --autogenerate -m "describe"` |
| Run migrations | `docker compose exec backend alembic upgrade head` |

## Item ID notation

Use stable `[ITEM-ID]` identifiers from the ROADMAP (e.g. `[T1]`, `[P1]`, `[AI-BTN1]`).
✅ = done, `[ ]` = open, `[~]` = partially done.
