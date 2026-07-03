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
        how to get the most out of your account. No fluff, just the good stuff.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
        Got a question? Just reply. A real person reads every one.
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
  {
    id: 'yippie-professional',
    name: 'Yippie Professional',
    description: 'Branded email with logo header and clean layout.',
    html: `<table align="center" width="100%" style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;border-spacing:0;">
  <!-- Logo header -->
  <tr>
    <td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">
      <img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />
    </td>
  </tr>
  <!-- Accent bar -->
  <tr><td style="height:4px;background:#5BA4F5;"></td></tr>
  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 8px 8px;">
      <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 16px;">Hello from our team 👋</h1>
      <p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">
        We have something important to share with you. This email was sent just for you, and we'd love for you to take a moment to read it.
      </p>
      <p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">
        If you have any questions, just hit reply. A real person will get back to you.
      </p>
      <p style="margin:0 0 8px;text-align:center;">
        <a href="#" style="display:inline-block;padding:13px 32px;background:#5BA4F5;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">Take action</a>
      </p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">
      Sent with Yippie
    </td>
  </tr>
</table>`,
  },
  {
    id: 'support-update',
    name: 'Support update',
    description: 'Ticket confirmation, status update, or resolution. Ready to send.',
    html: `<table align="center" width="100%" style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f1f5f9;border-spacing:0;">
  <!-- Logo header -->
  <tr>
    <td style="background:#ffffff;padding:28px 40px 20px;text-align:center;border-radius:8px 8px 0 0;">
      <img src="https://getyippie.com/logo-white-bg.svg" alt="Yippie" style="height:36px;border:0;display:inline-block;" />
    </td>
  </tr>
  <!-- Accent bar -->
  <tr><td style="height:4px;background:#5BA4F5;"></td></tr>
  <!-- Body card -->
  <tr>
    <td style="background:#ffffff;padding:40px 40px 36px;border-radius:0 0 8px 8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <!-- Status pill -->
      <p style="margin:0 0 20px;">
        <span style="display:inline-block;padding:4px 12px;background:#eff6ff;color:#2563eb;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">Update</span>
      </p>
      <!-- Headline -->
      <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 12px;line-height:1.3;">We have an update on your request</h1>
      <!-- Divider -->
      <div style="height:1px;background:#e2e8f0;margin:0 0 20px;"></div>
      <!-- Body -->
      <p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">
        Hi [First name],
      </p>
      <p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 14px;">
        Thank you for reaching out. We wanted to keep you in the loop. Here's the latest on your request:
      </p>
      <!-- Highlighted note box -->
      <table width="100%" style="margin:0 0 24px;border-spacing:0;">
        <tr>
          <td style="background:#f8fafc;border-left:3px solid #5BA4F5;border-radius:0 6px 6px 0;padding:14px 18px;">
            <p style="font-size:14px;line-height:1.6;color:#475569;margin:0;">
              [Describe the update, what action was taken, or what the current status is. Keep it concise and clear.]
            </p>
          </td>
        </tr>
      </table>
      <p style="font-size:15px;line-height:1.65;color:#374151;margin:0 0 28px;">
        If you have any follow-up questions, you can reply directly to this email. We're here to help.
      </p>
      <!-- CTA -->
      <p style="margin:0;text-align:center;">
        <a href="#" style="display:inline-block;padding:13px 32px;background:#5BA4F5;color:#ffffff;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">View your ticket</a>
      </p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="padding:20px 0;text-align:center;font-size:12px;color:#94a3b8;">
      Sent with Yippie &nbsp;·&nbsp; <a href="#" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
    </td>
  </tr>
</table>`,
  },
]
