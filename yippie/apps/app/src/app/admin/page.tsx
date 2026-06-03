import { db } from "@/lib/db";
import Link from "next/link";

export default async function AdminPage() {
  const companies = await db.company.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 2rem", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Companies</h1>
        <Link href="/admin/companies/new" style={linkBtn}>
          + New company
        </Link>
      </div>

      {companies.length === 0 ? (
        <p style={{ color: "#999" }}>No companies yet. Create your first one.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
              <th style={th}>Name</th>
              <th style={th}>Slug</th>
              <th style={th}>Users</th>
              <th style={th}>Created</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={td}>{c.name}</td>
                <td style={{ ...td, color: "#999" }}>{c.slug}</td>
                <td style={td}>{c._count.users}</td>
                <td style={{ ...td, color: "#999" }}>
                  {c.createdAt.toLocaleDateString()}
                </td>
                <td style={td}>
                  <Link href={`/admin/companies/${c.id}`} style={{ color: "#2563eb" }}>
                    Manage
                  </Link>
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
const linkBtn = {
  background: "#111",
  color: "#fff",
  padding: "0.5rem 1rem",
  borderRadius: "4px",
  textDecoration: "none",
  fontSize: "0.875rem",
} as React.CSSProperties;
