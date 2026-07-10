// One-shot runtime verification of the 2026-07-10 UI/UX batch against the LIVE site.
// Run from apps/web:  node scripts/verify_ui_batch.mjs
// Screenshots land in /tmp/yippie_verify/.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/tmp/yippie_verify'
mkdirSync(OUT, { recursive: true })

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// Preflight: is the site even up? (distinguishes a Railway deploy problem from
// a playwright wait quirk)
for (const url of ['https://getyippie.com/', 'https://getyippie.com/pricing']) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    console.log(`↪ ${url} → HTTP ${res.status}`)
    if (!res.ok) check(`preflight ${url}`, false, `HTTP ${res.status} — site problem, not a script problem`)
  } catch (e) {
    check(`preflight ${url}`, false, `fetch failed: ${e.message}`)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1380, height: 900 } })
page.setDefaultTimeout(20_000)

// ── getyippie.com/pricing ──────────────────────────────────────────────
await page.goto('https://getyippie.com/pricing', { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForSelector('text=/€/', { timeout: 20_000 }).catch(() => {})
const pricingText = await page.textContent('body')
check('pricing: "Everything in …, plus:" tier delta framing', /Everything in [A-Za-z]+, plus:/.test(pricingText))
// discount line only shows on annual — dismiss any consent popup, then flip the toggle
if (!/Save €\d+\/yr \(was €\d+\)/.test(pricingText)) {
  const consent = page.locator('button').filter({ hasText: /accept|akkoord|prima|got it|ok/i }).first()
  if (await consent.count()) await consent.click().catch(() => {})
  await page.waitForTimeout(300)
  // the Annual segment is the only button containing "Save 10%"
  const annual = page.locator('button', { hasText: 'Save 10%' }).first()
  if (await annual.count()) {
    await annual.click({ force: true }).catch(e => console.log(`⚠ annual click failed: ${e.message}`))
  } else {
    console.log('⚠ no Annual toggle button found on /pricing')
  }
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/pricing_annual.png`, fullPage: true })
}
const pricingText2 = await page.textContent('body')
check('pricing: real € savings line ("Save €X/yr (was €Y)")', /Save €\d+\/yr \(was €\d+\)/.test(pricingText2))
check('pricing: old "10% off" copy gone', !/10% off \(was/.test(pricingText2))
await page.screenshot({ path: `${OUT}/pricing.png`, fullPage: true })

// ── getyippie.com homepage ─────────────────────────────────────────────
await page.goto('https://getyippie.com/', { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForTimeout(1500)
const shots = await page.locator('img[src*="/shots/"]').count()
check('homepage: real product screenshots (/shots/*)', shots >= 1, `${shots} found`)
const homeText = await page.textContent('body')
check('homepage: founder spots counter ("of 5 spots left")', /of 5 spots left/i.test(homeText))
await page.screenshot({ path: `${OUT}/homepage.png`, fullPage: true })

await browser.close()
const fails = results.filter(r => !r.ok).length
console.log(`\n${fails === 0 ? 'ALL RUNTIME CHECKS PASSED' : `${fails} CHECK(S) FAILED`} — screenshots in ${OUT}/`)
process.exit(fails === 0 ? 0 : 1)
