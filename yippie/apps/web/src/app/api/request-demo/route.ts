import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, company_name, email, questionnaire, website, lang } = body as Record<string, unknown>;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof company_name !== "string" || !company_name.trim() ||
    typeof email !== "string" || !email.trim()
  ) {
    return NextResponse.json({ error: "Your name, company, and work email are required." }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    name: name.trim(),
    company_name: company_name.trim(),
    email: email.trim(),
  };
  if (questionnaire && typeof questionnaire === "object") {
    payload.questionnaire = questionnaire;
  }
  // Honeypot field — forwarded as-is; the backend drops non-empty submissions.
  if (typeof website === "string") {
    payload.website = website;
  }
  // Visitor language from the marketing site (nl at root, en at /en) — the backend
  // uses it to pick the demo email language and seed the new user's ui_language.
  if (lang === "en" || lang === "nl") {
    payload.lang = lang;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${APP_URL}/api/v1/public/request-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable. Please try again." }, { status: 502 });
  }

  if (upstream.ok) {
    return NextResponse.json({ ok: true });
  }

  if (upstream.status === 409) {
    const body = await upstream.json().catch(() => ({}));
    const detail = typeof body?.detail === "string" ? body.detail : null;
    return NextResponse.json(
      { error: detail ?? "Email address already active, use app.getyippie.com to log in." },
      { status: 409 }
    );
  }

  if (upstream.status === 429) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  // Surface the upstream reason when we have one (validation 422, service
  // 503, etc.) rather than collapsing every failure into a generic message,
  // which made real causes impossible to diagnose.
  const upstreamBody = await upstream.json().catch(() => null);
  const rawDetail = upstreamBody?.detail;
  let detail: string | null = null;
  if (typeof rawDetail === "string") {
    detail = rawDetail;
  } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
    // FastAPI 422 validation errors are a list of {loc, msg, ...}
    const first = rawDetail[0];
    if (first && typeof first.msg === "string") detail = first.msg;
  }

  return NextResponse.json(
    { error: detail ?? "Something went wrong. Please try again." },
    { status: 502 }
  );
}
