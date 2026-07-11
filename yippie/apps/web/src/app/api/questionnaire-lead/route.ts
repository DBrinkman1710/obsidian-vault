import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${APP_URL}/api/v1/public/questionnaire-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[questionnaire-lead] upstream failed:", err);
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    console.error("[questionnaire-lead] upstream returned", upstream.status);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: upstream.status },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
