"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard/inbox", label: "Inbox", icon: "✉" },
  { href: "/dashboard/contacts", label: "Contacts", icon: "👥" },
  { href: "/dashboard/tickets", label: "Tickets", icon: "🎫" },
  { href: "/dashboard/chat", label: "Live Chat", icon: "💬" },
  { href: "/dashboard/activity", label: "Activity", icon: "📊" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
];

const adminItems = [
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
  { href: "/admin", label: "Admin panel", icon: "🔑" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isAdmin =
    session?.user?.role === "SUPER_ADMIN" ||
    session?.user?.role === "ADMIN";

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-white border-r border-gray-100 min-h-screen">
      {/* Logo + company name */}
      <div className="px-4 py-5 border-b border-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Yippie" className="h-9 w-auto mb-3" />
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
          Workspace
        </p>
        <p className="text-sm font-semibold text-gray-800 truncate">
          {session?.user?.companyName ?? "—"}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-gray-100" />
            {adminItems.map((item) => (
              <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)} />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 truncate mb-2">
          {session?.user?.email}
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-xs text-gray-500 hover:text-red-500 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-brand-50 text-brand-700 border-l-2 border-brand-500"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      {label}
    </Link>
  );
}
