import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : null;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const user = await db.user.update({
    where: { id: session.user.id },
    data: { name },
    select: { name: true },
  });

  return NextResponse.json(user);
}
