"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

async function createCompany(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const userName = formData.get("userName") as string;

  const company = await db.company.create({ data: { name, slug } });
  const hashed = await bcrypt.hash(password, 12);
  await db.user.create({
    data: {
      email,
      hashedPassword: hashed,
      name: userName || null,
      role: "ADMIN",
      companyId: company.id,
    },
  });

  redirect("/admin");
}

export default function NewCompanyPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 2rem", maxWidth: "480px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "2rem" }}>New company</h1>
      <form action={createCompany} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Field label="Company name" name="name" required />
        <Field label="Slug (URL-safe, e.g. acme-corp)" name="slug" required />
        <hr style={{ margin: "0.5rem 0" }} />
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#666" }}>First admin user</p>
        <Field label="Name" name="userName" />
        <Field label="Email" name="email" type="email" required />
        <Field label="Temporary password" name="password" type="password" required />
        <button
          type="submit"
          style={{ padding: "0.625rem", background: "#111", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "1rem" }}
        >
          Create company
        </button>
      </form>
    </main>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.875rem" }}>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        style={{ padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px", fontSize: "1rem" }}
      />
    </label>
  );
}
