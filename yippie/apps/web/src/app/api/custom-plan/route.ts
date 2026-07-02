import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, company_name, email, questionnaire } = body as Record<string, unknown>;

  if (
    typeof name !== "string" || !name.trim() ||
    typeof company_name !== "string" || !company_name.trim() ||
    typeof email !== "string" || !email.trim()
  ) {
    return NextResponse.json(
      { error: "name, company_name, and email are required." },
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
      { error: "Too many requests — try again later." },
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
