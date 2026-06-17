# Yippie marketing site — redesign hand-off prompts

Premium-light "tech" redesign. The **foundation is already built and the production
build passes**: design tokens, fonts (Space Grotesk / Inter / JetBrains Mono), inline
SVG icon set, `Reveal` scroll-motion, light `SiteNav` (+ mobile menu) & multi-column
`SiteFooter`, the home page, and all inner-page reskins (features / pricing / for-smbs /
for-agencies / vs-zendesk / blog, emoji → SVG). New brand logos are wired (nav =
`logo-white-bg.svg`, footer = `logo-black-bg.svg`); favicon already wired via
`src/app/icon.svg`. Demo CTA standardized on **`/request-demo`**.

**Remaining work = Tasks 5a / 5b / 5c (new pages), Task 6 (screenshots), Task 7 (verify).**
Run each through a separate Sonnet. Prepend the SHARED CONTEXT block to every task prompt.

---

## 📋 SHARED CONTEXT (prepend to each task prompt)

```
You are working on the Yippie marketing site at /Users/diederik/yippie/yippie/apps/web
(Next.js 14 App Router, TS, CSS Modules — NO Tailwind, NO new deps except where a task
says so). A premium-light "tech" design system is ALREADY BUILT and the production build
passes. Match it exactly. Run `pnpm type-check` (from apps/web) before finishing; the
final gate is `pnpm build`.

CANONICAL EXAMPLES to read first: src/app/page.tsx + page.module.css (home) and
src/app/features/page.tsx — copy their patterns, fonts, spacing, motion.

DESIGN TOKENS (src/app/globals.css — use the vars, never hardcode):
--brand #5BA4F5, --brand-700 (text on light), --brand-soft, --brand-soft-2, --brand-ring;
--ink #0F172A (headings + dark surfaces), --text, --muted, --faint, --border, --border-2,
--white, --off-white, --slate-50/100; --dark #0b1120 (product-moment); radii --r-sm/md/lg/
xl/pill; shadows --shadow-sm/md/lg/brand; --maxw 1180px; --gutter 6vw; fonts --font-display
(Space Grotesk → headings), --font-body (Inter), --font-mono (JetBrains Mono → eyebrows/
labels). Global utility classes: bgGrid, bgDots. Scroll-reveal via <Reveal>.

COMPONENTS (src/app/components/): SiteNav (default, client), SiteFooter (default),
Reveal (default, client; props {children, delay?:ms, as?, className?, style?}),
icons.tsx (props {size?, ...svg}): InboxIcon TicketIcon ChatIcon UsersIcon ActivityIcon
BillingIcon AiIcon CalendarIcon KanbanIcon MailTrackIcon TemplateIcon TeamIcon ShieldIcon
BoltIcon ClockIcon LayersIcon EditIcon CheckIcon ArrowRightIcon. NO EMOJI — use icons.

CONVENTIONS:
const APP_URL  = process.env.NEXT_PUBLIC_APP_URL  ?? "https://app.getyippie.com";
const DEMO_URL = process.env.NEXT_PUBLIC_DEMO_URL ?? "/request-demo";   // demo CTA target
Eyebrows are mono brand text; in content.module.css `.eyebrow` auto-prepends "// " (pass
plain text). Always render <SiteNav/> first and <SiteFooter/> last.

LOGO ASSETS in /public (each has a baked-in bg rect — match variant to surface!):
logo-white-bg.svg (white rect, for light), logo-black-bg.svg (#0F172A rect, for dark/ink),
logo-blue-bg.svg (#5BA4F5 rect), plus *-mark.svg (mark only). Favicon already wired.
```

---

## TASK 5a — `/about`

```
Build src/app/about/page.tsx (server component) — editorial story/mission/values/team page
in the established premium-light system. Add about.module.css only for new layouts (values
grid, stats row, team grid with brand-gradient initial avatars). Sections (wrap in <Reveal>):
hero (content.module.css .hero/.heroTag/.heroTitle/.heroSub, tag "Our story"); mission
paragraph; values grid (3–4 cards using BoltIcon/LayersIcon/ShieldIcon/UsersIcon in
brand-soft .iconWrap tiles); a stats row (big brand numbers + mono labels, like the home
stats); team grid (initials on brand gradient, placeholder names/roles, clearly editable);
CTA (reuse .ctaSection/.ctaTitle/.ctaSub + primary button → DEMO_URL with ArrowRightIcon).
Add metadata (canonical "/about") like features/page.tsx. Add "/about" to src/app/sitemap.ts
(priority 0.7, monthly). pnpm type-check.
```

## TASK 5b — `/request-demo` + API route

```
1. src/app/api/request-demo/route.ts (POST): read {name, company_name, email}, validate,
   forward server-side to `${APP_URL}/api/v1/public/request-demo` with JSON
   {name, company_name, email} (endpoint confirmed at
   apps/app/backend/app/public/router.py:137 — RequestDemo{name, company_name, email,
   slug?}). Map upstream: 200→{ok:true}; 409→409 "An account with this email already
   exists."; 429→429 "Too many requests — try again later."; else→502 generic. No leaking.
2. src/app/request-demo/page.tsx: server shell (SiteNav, content.module.css hero, tag
   "Request a demo"), renders client <DemoForm/>, then SiteFooter.
3. src/app/request-demo/DemoForm.tsx ("use client"): controlled Name/Company/Work-email
   (all required) → POST /api/request-demo. States idle/submitting/success/error: success
   swaps to a confirmation panel; error shows inline msg + keeps values; button shows
   "Sending…" + disabled. Style premium-light in request-demo.module.css: card (#fff,
   --border, --r-lg, --shadow-md), mono labels, inputs focus to --brand with
   box-shadow 0 0 0 4px var(--brand-soft), submit like home .btnPrimary (ink→brand).
Add metadata (canonical "/request-demo") + add to src/app/sitemap.ts (0.8, monthly).
NOTE: pricing/page.tsx already links to /request-demo. pnpm type-check.
```

## TASK 5c — `/modules`

```
Build src/app/modules/page.tsx (server) — in-depth product page, one section per module,
alternating image-left/right, in the premium-light system. Add modules.module.css for the
two-column feature blocks. Use next/image for screenshots at /public/shots/<name>.png inside
a browser-chrome frame (reuse the ProductMockup frame look in src/app/page.tsx: top bar with
3 dots + mono URL, --shadow-lg). The page MUST compile and look right even before the PNGs
exist (Task 6 produces them). Modules (title, mono kicker e.g. "// INBOX", 3–4 CheckIcon
bullets, screenshot file, deep link APP_URL+path, icon):
Inbox/shots/inbox.png//inbox/InboxIcon · Tickets/shots/tickets.png//tickets/TicketIcon ·
Contacts/shots/contacts.png//contacts/UsersIcon · Calendar+Booking/shots/calendar.png/
/calendar/CalendarIcon · Pipeline/shots/pipeline.png//pipeline/KanbanIcon · Live Chat/
shots/chat.png//chat/ChatIcon · Email Tracking/shots/email-tracking.png//billing/
MailTrackIcon · Templates/shots/templates.png//settings/templates/TemplateIcon · Activity/
shots/activity.png//activity/ActivityIcon · Team/shots/team.png//settings/team/TeamIcon.
Pull richer copy from src/app/features/page.tsx. Wrap blocks in <Reveal>; alternate sides.
Add a hero (tag "The product") + closing CTA (DEMO_URL). Add metadata (canonical "/modules")
+ add "/modules" to src/app/sitemap.ts (0.9, monthly). pnpm type-check.
```

## TASK 6 — screenshots

```
Capture product screenshots into apps/web/public/shots/.
1. From apps/web: `pnpm add -D playwright && npx playwright install chromium`.
2. Create apps/web/scripts/capture-shots.mjs (ESM, Playwright chromium): creds from env
   SHOT_EMAIL/SHOT_PASSWORD, base from SHOT_BASE_URL (default https://devsandbox.getyippie.com);
   if creds missing, print usage + exit 1. Viewport 1440x900 @2x. Log in at `${BASE}/login`
   (inspect apps/app/frontend/src/auth/LoginPage.tsx for selectors; prefer getByLabel/
   type=email|password), wait for redirect to /inbox. For each route, goto + networkidle +
   ~1200ms settle + screenshot to public/shots/<name>.png, each wrapped in try/catch
   (continue on failure, log per route): /inbox→inbox /tickets→tickets /contacts→contacts
   /calendar→calendar /pipeline→pipeline /chat→chat /billing→email-tracking /activity→
   activity /settings/templates→templates /settings/team→team (routes per
   apps/app/frontend/src/App.tsx). Add package.json script "shots":"node scripts/
   capture-shots.mjs". NEVER commit creds. Print files written.
RUNNER (human): SHOT_EMAIL=… SHOT_PASSWORD=… pnpm -C apps/web shots  (devsandbox superadmin
creds). Flag any empty/sparse module so a hand-built mockup can replace it on /modules.
```

## TASK 7 — verify

```
From apps/web: `pnpm type-check` (clean) then `pnpm build` (must succeed — deploy gate,
prod standalone binds 8080). `pnpm dev` and walk: / /modules /features /pricing /for-smbs
/for-agencies /vs-zendesk /about /request-demo /blog + 2 posts. Check: consistent light
nav/footer, mobile menu <860px, NO emoji, fonts load, scroll-reveal fires, brand #5BA4F5 as
accent, logos correct per surface, screenshots render on /modules. Submit /request-demo once
(success) then again same email (409 message). Responsive 375/768/1440. Report issues; do
NOT deploy (deploy = `git push origin commercial`, only when Diederik asks).
```

---

## Suggested order
5a / 5b / 5c can run in parallel (5c compiles without the screenshots). Then 6, then 7.
```
