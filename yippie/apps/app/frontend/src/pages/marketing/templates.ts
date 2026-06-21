// MKTG1 — starter email templates (static, frontend-only). Loaded into the
// GrapesJS canvas as a starting point. Inline styles keep them email-safe.

export interface StarterTemplate {
  id: string
  name: string
  description: string
  html: string
}

const SHELL = (inner: string) =>
  `<table align="center" width="100%" style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <tr><td style="padding:24px;">${inner}</td></tr>
  </table>`

const button = (label: string) =>
  `<a href="#" style="display:inline-block;padding:12px 28px;background:#5BA4F5;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">${label}</a>`

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'Greet new contacts and set expectations.',
    html: SHELL(`
      <h1 style="font-size:24px;margin:0 0 12px;">Welcome aboard 👋</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        We're thrilled to have you with us. Over the next few days we'll show you
        how to get the most out of your account — no fluff, just the good stuff.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        Got a question? Just reply to this email — a real person reads every one.
      </p>
      <p style="margin:0 0 8px;">${button('Get started')}</p>
    `),
  },
  {
    id: 'promo',
    name: 'Promotional offer',
    description: 'Announce a limited-time deal with a clear CTA.',
    html: SHELL(`
      <div style="background:#fef3c7;color:#92400e;display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:16px;">LIMITED TIME</div>
      <h1 style="font-size:26px;margin:0 0 12px;">Save 25% this week only</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        For the next 7 days, get 25% off your upgrade. It's our way of saying
        thanks for being part of the community.
      </p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">Use code <b>SAVE25</b> at checkout.</p>
      <p style="margin:0 0 8px;">${button('Claim my discount')}</p>
    `),
  },
  {
    id: 'reengage',
    name: 'Re-engagement',
    description: 'Win back contacts who have gone quiet.',
    html: SHELL(`
      <h1 style="font-size:24px;margin:0 0 12px;">We've missed you</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        It's been a while! A lot has changed since you last stopped by, and we'd
        love to show you what's new.
      </p>
      <ul style="font-size:15px;line-height:1.7;margin:0 0 24px;padding-left:20px;color:#374151;">
        <li>Faster, simpler workflows</li>
        <li>New automations that save hours</li>
        <li>The same team you already know</li>
      </ul>
      <p style="margin:0 0 8px;">${button('Take another look')}</p>
    `),
  },
]
