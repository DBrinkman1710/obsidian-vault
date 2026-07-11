import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, company_name, email, questionnaire, website } = body as Record<string, unknown>;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof company_name !== "string" || !company_name.trim() ||
    typeof email !== "string" || !email.trim()
  ) {
    return NextResponse.json(
      { error: "Your name, company, and work email are required." },
      { status: 400 },
    );
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

  let upstream: Response;
  try {
    upstream = await fetch(`${APP_URL}/api/v1/public/custom-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  if (upstream.ok) {
    return NextResponse.json({ ok: true });
  }

  if (upstream.status === 429) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  const upstreamBody = await upstream.json().catch(() => null);
  const rawDetail = upstreamBody?.detail;
  let detail: string | null = null;
  if (typeof rawDetail === "string") {
    detail = rawDetail;
  } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
    const first = rawDetail[0];
    if (first && typeof first.msg === "string") detail = first.msg;
  }

  return NextResponse.json(
    { error: detail ?? "Something went wrong. Please try again." },
    { status: 502 },
  );
}
