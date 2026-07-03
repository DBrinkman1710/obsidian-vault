import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.getyippie.com";

export async function POST(req: NextRequest) {
  let raw_message: string | undefined;
  try {
    const body = await req.json();
    raw_message = typeof body?.raw_message === "string" ? body.raw_message.trim() : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!raw_message) {
    return NextResponse.json({ error: "raw_message is required." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${APP_URL}/api/v1/public/ai-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_message: raw_message.slice(0, 4000) }),
    });
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 502 });
  }

  if (upstream.ok) {
    const data = await upstream.json();
    return NextResponse.json(data);
  }

  if (upstream.status === 429) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  if (upstream.status === 503) {
    return NextResponse.json({ error: "AI service not available right now." }, { status: 503 });
  }

  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
}
