import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const MEMBER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

function requireAdmin(session: Session | null) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const deny = requireAdmin(session);
  if (deny) return deny;

  const members = await db.user.findMany({
    where: { companyId: session!.user.companyId },
    select: MEMBER_SELECT,
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const deny = requireAdmin(session);
  if (deny) return deny;

  const { name, email, password, role } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (role && !["MEMBER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const member = await db.user.create({
    data: {
      email,
      hashedPassword: hashed,
      name: name || null,
      role: role ?? "MEMBER",
      companyId: session!.user.companyId,
    },
    select: MEMBER_SELECT,
  });

  return NextResponse.json(member, { status: 201 });
}
