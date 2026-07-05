#!/usr/bin/env node
// Regenerates every derived module/pricing file from the canonical source
// (packages/config/modules.json). Run `pnpm sync:config` after editing that
// file. Run with `--check` (pnpm check:config) to fail if any generated file is
// stale — wired into CI / pre-push so drift can never land silently.
//
// Generated targets:
//   • apps/app/backend/app/core/_modules_gen.py   (Python backend)
//   • apps/web/src/lib/config.ts                  (marketing site)
//   • packages/config/pricing.ts                  (workspace package, kept honest)
//   • packages/config/modules.ts                  (workspace package, kept honest)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const SRC = resolve(HERE, "modules.json");

const cfg = JSON.parse(readFileSync(SRC, "utf8"));
const modules = cfg.modules;
const plans = cfg.plans;

const paid = modules.filter((m) => m.price != null && !m.core);
const stripeKey = (id) => `yippie_module_${id}`;

const AUTOGEN_PY = "# DO NOT EDIT — generated from packages/config/modules.json by packages/config/sync.mjs.\n# Run `pnpm sync:config` after editing modules.json.\n";
const AUTOGEN_TS = "// DO NOT EDIT — generated from packages/config/modules.json by packages/config/sync.mjs.\n// Run `pnpm sync:config` after editing modules.json.\n";

// ── Python: apps/app/backend/app/core/_modules_gen.py ───────────────────────
function pyVal(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}
function pyDict(obj, indent = "    ") {
  const rows = Object.entries(obj).map(
    ([k, v]) => `${indent}${JSON.stringify(k)}: ${typeof v === "object" && v !== null ? pyInlineDict(v) : pyVal(v)},`,
  );
  return `{\n${rows.join("\n")}\n}`;
}
function pyInlineDict(obj) {
  const inner = Object.entries(obj)
    .map(([k, v]) => `${JSON.stringify(k)}: ${pyVal(v)}`)
    .join(", ");
  return `{${inner}}`;
}

function buildPython() {
  const allIds = modules.map((m) => m.id);
  const coreIds = modules.filter((m) => m.core).map((m) => m.id);
  const modulePrices = Object.fromEntries(paid.map((m) => [m.id, m.price]));
  const stripeKeys = Object.fromEntries(paid.map((m) => [stripeKey(m.id), m.id]));
  const planLimits = Object.fromEntries(
    Object.entries(plans).map(([name, p]) => [
      name,
      {
        users: p.users,
        contacts: p.contacts,
        ai_scans: p.aiScans,
        price_monthly: p.priceMonthly,
        price_annual: p.priceAnnual,
        module_discount: p.moduleDiscount,
      },
    ]),
  );
  const meta = Object.fromEntries(
    modules.map((m) => [
      m.id,
      { label: m.label, icon: m.icon, desc: m.desc, core: !!m.core, price: m.price ?? null },
    ]),
  );

  return (
    AUTOGEN_PY +
    "from __future__ import annotations\n\n" +
    `ALL_MODULES: list[str] = ${JSON.stringify(allIds)}\n\n` +
    `CORE_MODULES: list[str] = ${JSON.stringify(coreIds)}\n\n` +
    "# Paid add-on prices (euros/month), keyed by module id.\n" +
    `MODULE_PRICES: dict[str, int] = ${pyDict(modulePrices)}\n\n` +
    "# Stripe Checkout price lookup_key -> module id (paid add-ons only).\n" +
    `MODULE_STRIPE_KEYS: dict[str, str] = ${pyDict(stripeKeys)}\n\n` +
    `PLAN_ORDER: list[str] = ${JSON.stringify(Object.keys(plans))}\n\n` +
    `PLAN_LIMITS: dict[str, dict] = ${pyDict(planLimits)}\n\n` +
    "# Display metadata for pickers/pricing UIs.\n" +
    `MODULE_META: dict[str, dict] = ${pyDict(meta)}\n`
  );
}

// ── TS objects shared by web config + packages/config ───────────────────────
function tsPlanLimits() {
  const rows = Object.entries(plans).map(([name, p]) => {
    const pad = " ".repeat(Math.max(1, 11 - name.length));
    return `  ${name}:${pad}{ users: ${p.users ?? "null"}, contacts: ${p.contacts ?? "null"}, aiScans: ${p.aiScans ?? "null"}, priceMonthly: ${p.priceMonthly ?? "null"}, priceAnnual: ${p.priceAnnual ?? "null"}, moduleDiscount: ${p.moduleDiscount} },`;
  });
  return `{\n${rows.join("\n")}\n} as const`;
}
function tsModulePrices() {
  const rows = paid.map((m) => `  ${m.id}: ${m.price},`);
  return `{\n${rows.join("\n")}\n} as const`;
}
function tsModuleList() {
  const rows = modules.map((m) => {
    const fields = [
      `id: ${JSON.stringify(m.id)}`,
      `label: ${JSON.stringify(m.label)}`,
      `icon: ${JSON.stringify(m.icon)}`,
      `desc: ${JSON.stringify(m.desc)}`,
      `core: ${!!m.core}`,
      `price: ${m.price ?? "null"}`,
      `recName: ${m.recName ? JSON.stringify(m.recName) : "null"}`,
    ];
    return `  { ${fields.join(", ")} },`;
  });
  return `[\n${rows.join("\n")}\n] as const`;
}

function buildWebConfig() {
  return (
    AUTOGEN_TS +
    `export const PLAN_LIMITS = ${tsPlanLimits()};\n\n` +
    `export const MODULE_PRICES = ${tsModulePrices()};\n\n` +
    "// Ordered module catalogue (id, label, icon, desc, core, price, recName).\n" +
    `export const MODULE_LIST = ${tsModuleList()};\n\n` +
    "export type PlanTier = keyof typeof PLAN_LIMITS;\n" +
    "export type ModuleId = (typeof MODULE_LIST)[number][\"id\"];\n"
  );
}

function buildPackagePricing() {
  return (
    AUTOGEN_TS +
    `export const PLAN_LIMITS = ${tsPlanLimits()};\n\n` +
    `export const MODULE_PRICES = ${tsModulePrices()};\n\n` +
    "export type PlanTier = keyof typeof PLAN_LIMITS;\n"
  );
}

function buildPackageModules() {
  const ids = modules.map((m) => m.id);
  return (
    AUTOGEN_TS +
    `export const MODULE_IDS = ${JSON.stringify(ids, null, 2).replace(/\n/g, "\n")} as const;\n\n` +
    "export type ModuleId = (typeof MODULE_IDS)[number];\n"
  );
}

// ── Emit / check ────────────────────────────────────────────────────────────
const targets = [
  { path: resolve(ROOT, "apps/app/backend/app/core/_modules_gen.py"), content: buildPython() },
  { path: resolve(ROOT, "apps/web/src/lib/config.ts"), content: buildWebConfig() },
  { path: resolve(ROOT, "packages/config/pricing.ts"), content: buildPackagePricing() },
  { path: resolve(ROOT, "packages/config/modules.ts"), content: buildPackageModules() },
];

const check = process.argv.includes("--check");
let stale = 0;
for (const t of targets) {
  let current = null;
  try {
    current = readFileSync(t.path, "utf8");
  } catch {
    current = null;
  }
  const rel = t.path.replace(ROOT + "/", "");
  if (current === t.content) {
    console.log(`  ok    ${rel}`);
    continue;
  }
  if (check) {
    console.error(`  STALE ${rel}`);
    stale++;
  } else {
    writeFileSync(t.path, t.content);
    console.log(`  wrote ${rel}`);
  }
}

if (check && stale > 0) {
  console.error(`\n${stale} generated file(s) out of date. Run \`pnpm sync:config\` and commit.`);
  process.exit(1);
}
console.log(check ? "\nconfig in sync ✓" : "\nsync:config done ✓");
