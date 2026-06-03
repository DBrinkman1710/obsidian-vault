import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileSection } from "./ProfileSection";
import { TeamSection } from "./TeamSection";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin =
    session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN";

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <ProfileSection
        initialName={session.user.name ?? ""}
        email={session.user.email ?? ""}
      />
      {isAdmin && <TeamSection currentUserId={session.user.id} />}
    </div>
  );
}
