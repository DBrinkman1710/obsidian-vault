import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>
        {session?.user.companyName}
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Welcome back, {session?.user.name ?? session?.user.email}
      </p>
      <p style={{ color: "#999", fontSize: "0.875rem" }}>
        Dashboard coming soon.
      </p>
    </main>
  );
}
