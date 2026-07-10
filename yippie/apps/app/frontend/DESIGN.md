# Yippie app design contract

Every module ships the same UI language. This file is the contract; `scripts/ui_drift_check.mjs` (run via `pnpm run check:ui`, wired into pre commit) enforces the mechanical parts. If you need something this contract doesn't cover, extend the shared layer first — don't roll a one off in your module.

## Tokens (tailwind.config.js + index.css)

| Need | Use | Never |
|---|---|---|
| Brand | `yippie` (DEFAULT #5BA4F5) + `yippie-50…900` ramp | raw `blue-*` for brand surfaces |
| Success | `success-50/100/200/500/600/700` or `--status-success(-bg)` | `green-*`, `emerald-*` |
| Warning | `warning-*` or `--status-high(-bg)` | `amber-*`, `yellow-*`, `orange-*` |
| Danger | `danger-*` or `--status-urgent(-bg)` | `red-*`, `rose-*` |
| Info | `info-*` or `--status-info(-bg)` | ad hoc `blue-*` |
| Shadows | token classes (`shadow-sm/md/lg/2xl/brand`) — soft: low opacity, high blur | arbitrary `shadow-[…]` |
| Radii | `rounded-sm/md/lg/xl` tokens (8/12/16/22px); cards are `rounded-2xl` | mixing radii on sibling cards |

## Type

- Page titles: `.heading-xl` (24px — the dashboard cap, nothing renders larger). Section titles `.heading-lg`, card titles `.heading-md`, sub headers `.heading-sm`.
- Body is `text-sm`; metadata `text-xs`. Fonts: Space Grotesk (display, via the heading classes), Inter (body), JetBrains Mono (code/tokens).
- `text-3xl+` never appears in the app (drift check enforces).

## Shared primitives — use them, don't re-derive them

| Situation | Primitive |
|---|---|
| Primary / secondary / destructive button | `.btn-primary` / `.btn-secondary` / `.btn-danger` / `.btn-ghost-danger` + `px-* py-*` at the callsite |
| Text input / select / textarea | `.input-base` (+ `.input-error` on validation failure) |
| Form / banner errors | `.error-text`, `.error-banner`, `.success-banner`, `.warning-banner` |
| Modal close X | `shell/CloseButton` |
| Modal overlay | `bg-black/40`, container `rounded-2xl shadow-2xl`, header/footer `px-6 py-4`, Cancel left / primary right |
| List loading | `shell/Skeleton` primitives (spinners only on pending buttons) |
| Empty list | `components/EmptyState` — illustration + one CTA, never a bare paragraph |
| Row/context actions | `components/ContextMenu` + a visible ⋮ trigger |
| Copy to clipboard | `hooks/useCopy` (per call message supported) — never raw `navigator.clipboard` |
| Multi select | `components/Selection` (useSelection/Checkbox/BulkBar) |
| Toasts | `sonner` — destructive ops prefer delete + "Deleted — Undo" toast over confirm dialogs |
| Status/priority pills | `lib/statusStyles.ts` (drives from `--status-*` vars) |
| Dates / money / relative time | `lib/format.ts` (`fmtDate`/`fmtDateTime`/`timeAgo`/`fmtMoney`) — one locale everywhere |

## Icons

Lucide only — no dingbats (⚠ ✓ ✕) or emoji as icons. Sizes: 12 badges, 14 row actions, 18 prominent/close.

## Behavioural conventions

- Irreversible actions get motion feedback (`card-exit`, `check-pulse` keyframes).
- Every mutation-bound button shows its pending state (disabled + spinner).
- Every empty state funnels to creation; every list has a skeleton.
- No emojis in UI copy; no hyphens in artefact names.
- Dark mode is out of scope — don't add `dark:` variants.

## The ratchet

`scripts/ui_drift_baseline.json` records how much legacy drift each rule still tolerates. New code must not add to it (pre commit fails). When you clean up a module, run `node scripts/ui_drift_check.mjs --update-baseline` in the same commit so the ceiling drops behind you.
