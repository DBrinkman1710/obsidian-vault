"use client";

import { useState } from "react";

interface Props {
  initialName: string;
  email: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function ProfileSection({ initialName, email }: Props) {
  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<SaveStatus>("idle");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwStatus, setPwStatus] = useState<SaveStatus>("idle");
  const [pwError, setPwError] = useState("");

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameStatus("saving");
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNameStatus("saved");
      setTimeout(() => setNameStatus("idle"), 2000);
    } else {
      setNameStatus("error");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwStatus("saving");
    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    if (res.ok) {
      setPwStatus("saved");
      setCurrentPw("");
      setNewPw("");
      setTimeout(() => setPwStatus("idle"), 2000);
    } else {
      const data = await res.json();
      setPwError(data.error ?? "Something went wrong");
      setPwStatus("error");
    }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-100">
      <div className="px-6 py-5">
        <h2 className="text-sm font-semibold text-gray-900">Your account</h2>
      </div>

      <form onSubmit={saveName} className="px-6 py-5 flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
          <input
            value={email}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={nameStatus === "saving"}
          className="shrink-0 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {nameStatus === "saving" ? "Saving…" : nameStatus === "saved" ? "Saved ✓" : "Save name"}
        </button>
      </form>

      <form onSubmit={changePassword} className="px-6 py-5">
        <p className="text-xs font-medium text-gray-600 mb-4">Change password</p>
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Current password</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">New password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {pwError && <p className="text-sm text-red-500 mb-3">{pwError}</p>}
        <button
          type="submit"
          disabled={pwStatus === "saving"}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {pwStatus === "saving" ? "Updating…" : pwStatus === "saved" ? "Updated ✓" : "Update password"}
        </button>
      </form>
    </section>
  );
}
