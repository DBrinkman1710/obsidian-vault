import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, company_name, email } = body as Record<string, unknown>;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof company_name !== "string" || !company_name.trim() ||
    typeof email !== "string" || !email.trim()
  ) {
    return NextResponse.json({ error: "name, company_name, and email are required." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${APP_URL}/api/v1/public/request-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        company_name: company_name.trim(),
        email: email.trim(),
      }),
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
      { error: "Too many requests — try again later." },
      { status: 429 }
    );
  }

  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 502 }
  );
}
