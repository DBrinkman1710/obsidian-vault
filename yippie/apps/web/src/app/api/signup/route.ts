import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  if (
    typeof b.name !== "string" || !b.name.trim() ||
    typeof b.company_name !== "string" || !b.company_name.trim() ||
    typeof b.email !== "string" || !b.email.trim()
  ) {
    return NextResponse.json(
      { error: "Your name, company name, and work email are required." },
      { status: 400 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${APP_URL}/api/v1/public/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again." }, { status: 502 });
  }

  if (upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    // Stripe hook: backend returns { payment: { type: "stripe", checkout_url: "..." }, login_url, tenant_slug }.
    // Frontend checks data.payment?.checkout_url and redirects to Stripe Checkout automatically.
    // Until Stripe is live, backend returns { payment: { type: "invoice", invoice_id: "..." } } and signup completes immediately.
    return NextResponse.json(data, { status: 201 });
  }

  if (upstream.status === 409) {
    const data = await upstream.json().catch(() => ({}));
    const detail = typeof data?.detail === "string" ? data.detail : null;
    return NextResponse.json(
      { error: detail ?? "This email is already registered." },
      { status: 409 }
    );
  }

  if (upstream.status === 429) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  // Try JSON first; fall back to text (Cloudflare replaces origin 5xx bodies with
  // its own text/plain error page, which causes json() to throw).
  let detail: string | null = null;
  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const upstreamBody = await upstream.json().catch(() => null);
    const rawDetail = upstreamBody?.detail;
    if (typeof rawDetail === "string") {
      detail = rawDetail;
    } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
      const first = rawDetail[0];
      if (first && typeof first.msg === "string") detail = first.msg;
    }
  }

  // 502/503 with no parseable detail = infrastructure error (e.g. email delivery
  // service down). Give a specific message rather than the generic fallback.
  const fallback =
    upstream.status === 502 || upstream.status === 503
      ? "We couldn't send your verification email right now. Please try again in a few minutes."
      : "Something went wrong. Please try again.";

  return NextResponse.json(
    { error: detail ?? fallback },
    { status: 502 }
  );
}
