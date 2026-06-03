"use client";

import { useEffect, useState } from "react";

type Member = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
};

interface Props {
  currentUserId: string;
}

const ROLES = ["MEMBER", "ADMIN"] as const;

export function TeamSection({ currentUserId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "MEMBER" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data) => { setMembers(data); setLoading(false); });
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSubmitting(false);
    if (res.ok) {
      const member = await res.json();
      setMembers((prev) => [...prev, member]);
      setForm({ name: "", email: "", password: "", role: "MEMBER" });
      setShowInvite(false);
    } else {
      const data = await res.json();
      setFormError(data.error ?? "Failed to add member");
    }
  }

  async function changeRole(userId: string, role: string) {
    const res = await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMembers((prev) => prev.map((m) => (m.id === userId ? updated : m)));
    }
  }

  async function remove(userId: string, displayName: string) {
    if (!confirm(`Remove ${displayName} from the workspace?`)) return;
    const res = await fetch(`/api/team/${userId}`, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((m) => m.id !== userId));
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
      <div className="px-6 py-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Team members</h2>
        <button
          onClick={() => { setShowInvite((v) => !v); setFormError(""); }}
          className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          {showInvite ? "Cancel" : "+ Add member"}
        </button>
      </div>

      {showInvite && (
        <form onSubmit={invite} className="px-6 py-5 bg-gray-50 space-y-4">
          <p className="text-xs font-medium text-gray-700">Add team member</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              label="Name (optional)"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <FormField
              label="Email *"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              required
            />
            <FormField
              label="Temporary password *"
              type="password"
              value={form.password}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              required
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Adding…" : "Add member"}
          </button>
        </form>
      )}

      <div className="divide-y divide-gray-50">
        {loading ? (
          <p className="px-6 py-5 text-sm text-gray-400">Loading…</p>
        ) : members.length === 0 ? (
          <p className="px-6 py-5 text-sm text-gray-400">No team members yet.</p>
        ) : (
          members.map((m) => {
            const isSelf = m.id === currentUserId;
            const display = m.name ?? m.email;
            return (
              <div key={m.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {display}
                    {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </p>
                  {m.name && (
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  )}
                </div>
                {isSelf ? (
                  <span className="text-xs text-gray-400 px-2 py-1">
                    {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                  </span>
                ) : (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => remove(m.id, display)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
