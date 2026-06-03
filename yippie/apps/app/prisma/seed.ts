import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super-admin ${email} already exists — skipping.`);
    return;
  }

  // Super-admin belongs to a system company
  const systemCompany = await db.company.upsert({
    where: { slug: "yippie-system" },
    update: {},
    create: { name: "Yippie", slug: "yippie-system" },
  });

  const hashed = await bcrypt.hash(password, 12);
  await db.user.create({
    data: {
      email,
      hashedPassword: hashed,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      companyId: systemCompany.id,
    },
  });

  console.log(`Created super-admin: ${email}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
