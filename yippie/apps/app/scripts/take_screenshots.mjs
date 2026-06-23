#!/usr/bin/env node
// Log into the demo tenant and screenshot every module for the marketing site.
//
// Usage:
//   node take_screenshots.mjs [base_url] [email] [password]
// Defaults:
//   https://sandbox.getyippie.com  admin@bright-horizons.demo  BrightDemo2026!
//
// Screenshots are written to apps/web/public/shots/{name}.png (1440x900 viewport).
// Set HEADED=1 to watch the browser run.

import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = (process.argv[2] || "https://sandbox.getyippie.com").replace(/\/$/, "");
const EMAIL = process.argv[3] || "admin@bright-horizons.demo";
const PASSWORD = process.argv[4] || "BrightDemo2026!";

// apps/app/scripts -> apps/web/public/shots
const OUT_DIR = resolve(__dirname, "../../web/public/shots");

// { filename, path } — one screenshot per module.
const TARGETS = [
  { file: "inbox.png", path: "/inbox" },
  { file: "tickets.png", path: "/tickets" },
  { file: "contacts.png", path: "/contacts" },
  { file: "calendar.png", path: "/calendar" },
  { file: "pipeline.png", path: "/pipeline" },
  { file: "chat.png", path: "/chat" },
  { file: "marketing.png", path: "/marketing" },
  { file: "billing.png", path: "/billing" },
  { file: "activity.png", path: "/activity" },
  // Departments live inside the Team settings page.
  { file: "departments.png", path: "/settings/team" },
  { file: "team.png", path: "/settings/team" },
  { file: "templates.png", path: "/settings/templates" },
  { file: "tracking.png", path: "/tracking" },
  { file: "sales.png", path: "/sales" },
  { file: "saas.png", path: "/saas" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !process.env.HEADED });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // --- Login -------------------------------------------------------------- //
  console.log(`Logging in at ${BASE_URL}/login as ${EMAIL}`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});

  await page.fill('input[type=email]', EMAIL);
  await page.fill('input[type=password]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);

  // Give the dashboard a moment to settle after auth.
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(1500);

  if (page.url().includes("/login")) {
    console.error("ERROR: still on /login after submit — check credentials / base URL.");
    await browser.close();
    process.exit(1);
  }
  console.log(`Logged in -> ${page.url()}`);

  // --- Screenshot each module -------------------------------------------- //
  let ok = 0;
  let failed = 0;
  for (const { file, path } of TARGETS) {
    const outPath = resolve(OUT_DIR, file);
    try {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await sleep(1500);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  + ${file}  (${path})`);
      ok++;
    } catch (err) {
      console.error(`  ! ${file}  (${path}) failed: ${err.message}`);
      failed++;
    }
  }

  await browser.close();
  console.log(`\nDone. ${ok} captured, ${failed} failed. Saved to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
