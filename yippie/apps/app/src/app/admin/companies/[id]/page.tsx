import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CompanyPage({ params }: { params: { id: string } }) {
  const company = await db.company.findUnique({
    where: { id: params.id },
    include: { users: { orderBy: { createdAt: "asc" } } },
  });
  if (!company) notFound();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <Link href="/admin" style={{ color: "#2563eb", fontSize: "0.875rem" }}>
        ← All companies
      </Link>
      <h1 style={{ fontSize: "1.5rem", margin: "1rem 0 0.25rem" }}>{company.name}</h1>
      <p style={{ color: "#999", margin: "0 0 2rem" }}>/{company.slug}</p>

      <h2 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Users ({company.users.length})</h2>
      {company.users.length === 0 ? (
        <p style={{ color: "#999" }}>No users yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Last login</th>
            </tr>
          </thead>
          <tbody>
            {company.users.map((u) => (
              <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={td}>{u.name ?? "—"}</td>
                <td style={td}>{u.email}</td>
                <td style={{ ...td, color: "#666", textTransform: "lowercase" }}>{u.role}</td>
                <td style={{ ...td, color: "#999" }}>
                  {u.lastLoginAt ? u.lastLoginAt.toLocaleDateString() : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const th = { padding: "0.5rem 0.75rem" } as React.CSSProperties;
const td = { padding: "0.625rem 0.75rem" } as React.CSSProperties;
