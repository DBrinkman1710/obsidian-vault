#!/usr/bin/env node
/**
 * capture-shots.mjs
 *
 * Logs into a running Yippie app instance and captures screenshots of
 * each product screen for use on the marketing site.
 *
 * Usage:
 *   SHOT_EMAIL=you@example.com SHOT_PASSWORD=secret node scripts/capture-shots.mjs
 *
 * Optional env vars:
 *   SHOT_BASE_URL   Base URL of the app (default: https://devsandbox.getyippie.com)
 *
 * Output:
 *   apps/web/public/shots/<name>.png  (1440x900 @2x Retina PNG)
 *
 * NEVER commit credentials — use env vars only.
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────

const EMAIL    = process.env.SHOT_EMAIL;
const PASSWORD = process.env.SHOT_PASSWORD;
const BASE     = (process.env.SHOT_BASE_URL ?? 'https://devsandbox.getyippie.com').replace(/\/$/, '');

if (!EMAIL || !PASSWORD) {
  console.error('Usage: SHOT_EMAIL=<email> SHOT_PASSWORD=<password> node scripts/capture-shots.mjs');
  console.error('Optional: SHOT_BASE_URL=<url>  (default: https://devsandbox.getyippie.com)');
  process.exit(1);
}

// Ordered list of [appRoute, outputName] pairs
const ROUTES = [
  ['/inbox',              'inbox'],
  ['/tickets',            'tickets'],
  ['/contacts',           'contacts'],
  ['/calendar',           'calendar'],
  ['/pipeline',           'pipeline'],
  ['/chat',               'chat'],
  ['/billing',            'email-tracking'],
  ['/activity',           'activity'],
  ['/settings/templates', 'templates'],
  ['/settings/team',      'team'],
];

const OUT_DIR = path.resolve(__dirname, '../public/shots');

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // ── Log in ────────────────────────────────────────────────────────────────
  console.log(`Logging in at ${BASE}/login …`);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from /login (lands on /inbox or /)
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15000 });
  console.log(`Logged in — now at ${page.url()}`);

  // ── Capture each route ────────────────────────────────────────────────────
  const written = [];

  for (const [route, name] of ROUTES) {
    try {
      console.log(`  → ${route} …`);
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      // Extra settle time for lazy-loaded content / animations
      await page.waitForTimeout(1200);

      const dest = path.join(OUT_DIR, `${name}.png`);
      await page.screenshot({ path: dest, fullPage: false });
      console.log(`     ✓ public/shots/${name}.png`);
      written.push(dest);
    } catch (err) {
      console.error(`     ✗ ${route} failed: ${err.message}`);
    }
  }

  await browser.close();

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\nFiles written:');
  for (const f of written) {
    console.log(' ', f);
  }
  console.log(`\n${written.length} / ${ROUTES.length} screenshots captured.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
