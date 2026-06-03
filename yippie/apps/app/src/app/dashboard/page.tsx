import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";

async function getStats() {
  // Placeholder — real counts slot in when ticket/contact/inbox tables exist
  return {
    openTickets: 0,
    contacts: 0,
    pendingInbox: 0,
    activeChats: 0,
  };
}

const recentActivity = [
  { id: 1, text: "No activity yet — create your first contact or ticket to get started.", time: "now", icon: "💡" },
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const stats = await getStats();
  const name = session?.user?.name ?? session?.user?.email ?? "there";
  const company = session?.user?.companyName ?? "your workspace";

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {name.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">{company}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon="🎫"
          label="Open Tickets"
          value={stats.openTickets}
          accent="blue"
          href="/dashboard/tickets"
        />
        <StatCard
          icon="👥"
          label="Contacts"
          value={stats.contacts}
          accent="gray"
          href="/dashboard/contacts"
        />
        <StatCard
          icon="✉"
          label="Pending Inbox"
          value={stats.pendingInbox}
          accent="amber"
          href="/dashboard/inbox"
        />
        <StatCard
          icon="💬"
          label="Active Chats"
          value={stats.activeChats}
          accent="green"
          href="/dashboard/chat"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">
            Recent Activity
          </h2>
          <ul className="space-y-4">
            {recentActivity.map((item) => (
              <li key={item.id} className="flex gap-3 items-start">
                <span className="mt-0.5 text-lg leading-none">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{item.text}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            <QuickAction href="/dashboard/tickets/new" label="New Ticket" icon="🎫" />
            <QuickAction href="/dashboard/contacts/new" label="New Contact" icon="👤" />
            <QuickAction href="/dashboard/inbox" label="Open Inbox" icon="✉" />
          </div>
        </div>
      </div>
    </div>
  );
}

type Accent = "blue" | "gray" | "amber" | "green";

const accentMap: Record<Accent, { bg: string; text: string; num: string }> = {
  blue:  { bg: "bg-blue-50",   text: "text-blue-600",  num: "text-blue-700"  },
  gray:  { bg: "bg-gray-50",   text: "text-gray-500",  num: "text-gray-800"  },
  amber: { bg: "bg-amber-50",  text: "text-amber-600", num: "text-amber-700" },
  green: { bg: "bg-green-50",  text: "text-green-600", num: "text-green-700" },
};

function StatCard({
  icon,
  label,
  value,
  accent,
  href,
}: {
  icon: string;
  label: string;
  value: number;
  accent: Accent;
  href: string;
}) {
  const colors = accentMap[accent];
  return (
    <Link
      href={href}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
    >
      <div className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center text-lg`}>
        {icon}
      </div>
      <div>
        <p className={`text-2xl font-bold ${colors.num}`}>{value}</p>
        <p className={`text-xs font-medium mt-0.5 ${colors.text}`}>{label}</p>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-sm font-medium text-gray-700 hover:text-blue-700"
    >
      <span>{icon}</span>
      {label}
    </Link>
  );
}
