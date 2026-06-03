import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
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

type Params = { params: { userId: string } };

async function resolveTarget(userId: string, companyId: string) {
  return db.user.findFirst({ where: { id: userId, companyId } });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const target = await resolveTarget(params.userId, session.user.companyId);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { role } = await req.json();
  if (!["MEMBER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: params.userId },
    data: { role },
    select: MEMBER_SELECT,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (params.userId === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const target = await resolveTarget(params.userId, session.user.companyId);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db.user.delete({ where: { id: params.userId } });

  return new NextResponse(null, { status: 204 });
}
