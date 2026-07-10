#!/usr/bin/env node
// UI/UX drift barrier — keeps module UIs converging on the shared design system
// instead of drifting apart again. Two modes per rule:
//   zero    — hard ban: any match fails.
//   ratchet — legacy debt exists: the count may only go DOWN. The allowed count
//             lives in ui_drift_baseline.json; lower it as debt is paid off
//             (run with --update-baseline after intentional cleanups).
//
// Run:  pnpm run check:ui            (from apps/app/frontend)
//       node scripts/ui_drift_check.mjs --update-baseline
//
// The design contract these rules enforce is documented in DESIGN.md.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const BASELINE_PATH = join(ROOT, 'scripts', 'ui_drift_baseline.json')
const UPDATE = process.argv.includes('--update-baseline')

// Every rule: id, mode, regex, human fix, optional file allowlist (substring match).
const RULES = [
  {
    id: 'focus_ring_blue',
    mode: 'zero',
    re: /focus:ring-blue-500/g,
    fix: 'Use the brand focus ring: focus:ring-yippie/30 (or .input-base).',
  },
  {
    id: 'oversized_dashboard_text',
    mode: 'zero',
    re: /text-(3|4|5|6)xl/g,
    fix: 'Dashboard cap is 24px: use .heading-xl or text-2xl.',
  },
  {
    id: 'raw_clipboard',
    mode: 'zero',
    re: /navigator\.clipboard/g,
    allow: ['hooks/useCopy.ts'],
    fix: 'Use the useCopy hook (supports per call toast messages).',
  },
  {
    id: 'dark_modal_overlay',
    mode: 'zero',
    re: /bg-black\/50/g,
    fix: 'Modal overlays are bg-black/40.',
  },
  {
    id: 'raw_semantic_palette',
    mode: 'ratchet',
    re: /(?:bg|text|border|ring)-(?:emerald|rose|green|red|amber|yellow|orange)-\d{2,3}/g,
    allow: ['lib/statusStyles.ts'],
    fix: 'Semantic colour goes through tokens: success-*/warning-*/danger-*/info-* or --status-* vars.',
  },
  {
    id: 'window_confirm',
    mode: 'ratchet',
    re: /(?:window\.)?confirm\(/g,
    fix: 'Use an inline undo toast (sonner) or a confirm modal — not the browser dialog.',
  },
  {
    id: 'loading_text',
    mode: 'ratchet',
    re: />\s*Loading…?\s*</g,
    fix: 'Use the Skeleton primitives (shell/Skeleton.tsx) for lists, spinners only on pending buttons.',
  },
  {
    id: 'dingbat_icons',
    mode: 'ratchet',
    re: /[⚠✓✕✗]/g,
    fix: 'Use lucide icons (AlertTriangle/Check/X) sized to line height.',
  },
  {
    id: 'ad_hoc_input_constant',
    mode: 'ratchet',
    re: /const\s+inputCls\s*=\s*['"`](?!input-base)/g,
    fix: 'inputCls constants must start from the shared .input-base class.',
  },
  {
    id: 'ad_hoc_page_heading',
    mode: 'ratchet',
    re: /<h[12][^>]*className="[^"]*text-2xl[^"]*font-(?:bold|extrabold)/g,
    fix: 'Page/section titles use .heading-xl / .heading-lg.',
  },
  {
    id: 'unlocalised_dates',
    mode: 'ratchet',
    re: /toLocale(?:Date|Time)?String\(/g,
    allow: ['lib/format.ts'],
    fix: 'Use fmtDate/fmtDateTime from lib/format.ts (single locale).',
  },
  {
    id: 'duplicated_status_maps',
    mode: 'ratchet',
    re: /const\s+(?:STATUS_STYLES|PRIORITY_STYLES)\s*[:=]/g,
    allow: ['lib/statusStyles.ts'],
    fix: 'Status/priority style maps live in lib/statusStyles.ts only.',
  },
]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, files)
    else if (/\.(tsx|ts|css)$/.test(entry.name)) files.push(p)
  }
  return files
}

const files = walk(SRC)
const results = {}
const hits = {}

for (const rule of RULES) {
  results[rule.id] = 0
  hits[rule.id] = []
  for (const file of files) {
    const rel = relative(ROOT, file)
    if (rule.allow?.some(a => rel.includes(a))) continue
    const text = readFileSync(file, 'utf8')
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      const m = line.match(rule.re)
      if (m) {
        results[rule.id] += m.length
        if (hits[rule.id].length < 8) hits[rule.id].push(`    ${rel}:${i + 1}  ${line.trim().slice(0, 100)}`)
      }
    })
  }
}

if (UPDATE) {
  const baseline = Object.fromEntries(RULES.filter(r => r.mode === 'ratchet').map(r => [r.id, results[r.id]]))
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n')
  console.log('Baseline updated:', JSON.stringify(baseline))
  process.exit(0)
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}
let failed = false

for (const rule of RULES) {
  const count = results[rule.id]
  if (rule.mode === 'zero') {
    if (count > 0) {
      failed = true
      console.error(`✗ ${rule.id}: ${count} match(es) — banned.\n  Fix: ${rule.fix}\n${hits[rule.id].join('\n')}`)
    }
  } else {
    const allowed = baseline[rule.id] ?? 0
    if (count > allowed) {
      failed = true
      console.error(`✗ ${rule.id}: ${count} matches, baseline allows ${allowed} — new drift introduced.\n  Fix: ${rule.fix}\n${hits[rule.id].join('\n')}`)
    } else if (count < allowed) {
      console.log(`↓ ${rule.id}: ${count} (baseline ${allowed}) — debt paid off; tighten with --update-baseline`)
    }
  }
}

if (failed) {
  console.error('\nUI drift check FAILED. The design contract is apps/app/frontend/DESIGN.md.')
  process.exit(1)
}
console.log('✓ UI drift check passed.')
