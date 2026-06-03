import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both passwords are required" }, { status: 400 });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const hashed = await bcrypt.hash(newPassword, 12);
  await db.user.update({ where: { id: session.user.id }, data: { hashedPassword: hashed } });

  return NextResponse.json({ ok: true });
}
