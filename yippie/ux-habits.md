# UX Habits — uxpeak video reference

Three uxpeak videos analysed 2026-07-08/09 for UX improvements. Used as input for [UX-PSYCH], [UX-CONV], and [UX-CRAFT] in ROADMAP.md.

---

## Video 1 — The UX Psychology Behind Apps People Can't Stop Using

**Channel:** uxpeak | **ID:** `2TlIg3VokY8`
**Source of:** [UX-CONV] (shipped 2026-07-08)

### Six psychology principles

**1. Smart defaults (decision fatigue)**
Stop giving users blank forms. Pre-fill the most common choice for every field. Columbia University jam study: 24 flavors → 3% bought; 6 flavors → 30% bought. 70–90% of users never change defaults — they read them as recommendations. The user's task shifts from "fill from scratch" to "scan and adjust." Button copy should reflect pre-computed results ("12 results waiting," not just "Search").

**2. Endowed progress (goal gradient effect)**
Columbia car wash study: a loyalty card pre-stamped with 2 of 10 stamps (same 8 washes needed) completed at nearly double the rate of a blank 8-stamp card. Never start a user at 0%. Count account creation as step 1, show the progress bar from there. LinkedIn's profile-strength meter is never at zero on sign-up. 0% feels like standing still; 20% feels like momentum.

**3. Reciprocity (value before ask)**
Give something real before asking for anything. Blurred-results-behind-a-login-wall = holding results hostage. Show a real partial report first; then offer the full breakdown in exchange for sign-up. Free samples at Costco increase purchases up to 2,000%. Spotify free trial, Notion full product before payment — they're not being generous, they're being strategic.

**4. Endowment effect / IKEA effect**
People value things they build themselves far more than identical pre-built items. Before the user creates an account, let them build something: choose their name, color, card style. Every choice makes it feel like theirs. The sign-up button becomes "Continue," not "Sign up," because leaving now means abandoning something they made. Duolingo: pick language, set goal, complete a lesson — then the account screen appears.

**5. Loss aversion (status quo bias)**
Kahneman: pain of losing is 2× more powerful than pleasure of gaining. "Upgrade now / Maybe later" has zero psychological weight. Instead, show what the user is about to lose (actual files, by name, with countdown). Dismiss copy: "I'll risk it," not "Maybe later." Never design a conversion screen without showing the cost of inaction.

**6. Contrast effect (anchoring)**
$50 protection plan shown alone → brain calculates $600/year → no thanks. Same $50 shown below a $1,900 laptop with "just 2.6%" → barely registers. Always control what the user sees first — that first number becomes the ruler they measure everything else against. Restaurants put a $90 steak on the menu not because it sells but because it makes the $40 salmon look reasonable.

---

## Video 2 — Every UI/UX Concept Explained in Under 10 Minutes

**Channel:** uxpeak | **ID:** `EcbgbKtOELY`
**Source of:** [UX-CRAFT] Batch 1 + 2

### Signifiers and affordances
UI should communicate how it works without instructions. Button press states, active nav highlights, hover states, tooltips, greyed-out inactive items, container grouping — all are signifiers. Good UI has many of them.

### Visual hierarchy
Size, position, color. Image at top for scannability. Most important thing: large, bold, top. Price: top-right, colored (different = eye is drawn to it). Small secondary info below. Icons + alignment over text labels where possible. Not an exact science — multiple valid hierarchies exist.

### Grids and white space
12-column grids are guidelines, not rules. More important: white space. 32px between sections; group related elements (announcement + text, text + subtext). Four-point grid system: everything a multiple of 4, so you can always split in half, creating consistency.

### Typography
One sans-serif font is almost always enough. **Heading tightening hack:** letter spacing −2% to −3%, line height 110–120% — instantly makes large text look professional. Dashboard text scale: nothing larger than 24px (information density). Marketing/landing pages: up to 6 distinct sizes across a larger range. Don't spend time on font selection; pick one and stick.

### Color
Start with one brand color. Lighten for backgrounds, darken for text. Build a color ramp (50→900) for chips, states, charts. **Semantic colors:** blue = trust/primary, red = danger/urgency, yellow = warning, green = success. Use color for meaning, not decoration. Let color find you through the content.

### Dark mode
Lower border contrast (less harsh than light mode). No shadows — use a lighter card than background to create depth. Dim chip saturation + brightness. Plenty of room for deep purples, reds, greens — not just navy/gray.

### Shadows
Most default shadows are too strong — reduce opacity, dial up blur. Cards need lighter shadows; popovers/content above other content need stronger ones. Inner/outer shadows for tactile raised buttons. Rule: if the shadow is the first thing you notice, it's wrong.

### Icons
Match icon size to the line height of the font (e.g., 24px font → 24px icon). Sidebar links are ghost buttons. Good button padding: width ≈ 2× height.

### Interaction states
Every button needs at minimum: default, hover, active/pressed, disabled. Sometimes: loading spinner. Inputs: focus state, error state (red border + message), optional warning state. Loading spinners on fetch, success messages on completion, micro animations on scroll/swipe. Every interaction needs a response.

### Micro-interactions
A step above feedback — confirms the action visually. Copy button: states alone don't confirm "copied." A chip sliding up does. Range from practical to playful.

### Image overlays
Never leave image-over-text as-is. Options in order: full-screen solid overlay (functional, not beautiful), linear gradient (image → text-readable background), progressive blur on top of gradient (most modern).

---

## Video 3 — Redesign a Vibe-Coded App into a Pro Product

**Channel:** uxpeak | **ID:** `PDcQJOPby1k`
**Source of:** [UX-CRAFT] Batch 1, 2, 3

### Icons
Replace emojis with interface icons (Phosphor, Lucide). Immediately more professional. Note: Notion pulls off emojis; most apps don't.

### Color — never let AI choose
AI picks bright colors that don't work together. Fix: shift backgrounds to lower-saturation, more intentional palette. Add micro charts to KPIs instead of decorative icons/buttons.

### Layout — never let AI choose
AI repeats the same KPIs 3× in a small app — redundancy is an AI tell. Sidebar: tighten spacing, align left, remove redundant links, collapse settings/billing/usage behind a single popover. Profile: replace gradient-letter circle with an account card + popover on click.

### Cards
AI makes them busy. Fix: collapse row actions into a triple-dot menu, move date to center, collapse chips to icon-only, align click counts to the right.

### Forms and modals
AI creates sparse forms with lots of empty space in a flyout. A modal is often more fitting for complex creation flows. Collapse advanced options by default. Add missing fields (custom domain toggle, description). Leave room for features to slot in without redesigning the layout.

### Analytics
Don't repeat KPIs across pages. Add a toggle to split/compare individual links. Pack more information into each row with helpful icons (adds color too). Replace bar charts with a map + shaded regions + data table for a richer experience.

### Pricing page
Fewer plans (5 is too many, drop one). Clear discount display — show what the user is actually saving. Show what the next tier includes that the current one doesn't. Emphasize price, de-emphasize plan name. Business → Enterprise when the usage tier warrants it. This pattern: Resend, Supabase. Add billing email + payment method for completeness.

### Landing pages
Most conversions are lost here when vibe-coded. There is a quality standard on SaaS landing pages that establishes trust subconsciously. Replace generic icons with real product screenshots. Skewed/angled product cards immediately elevate the page. "Landing pages aren't about complexity, they're about presentation."

### Already fine in Yippie (checked against codebase)
- 0 emojis in the UI (Video 3's top gripe does not apply)
- Gradient-letter avatars (30 usages) — established Yippie pattern, kept
