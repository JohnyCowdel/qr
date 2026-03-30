"use client";

import { useState, useTransition } from "react";

import { AdminNav } from "@/components/admin-nav";

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/password", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError((data.error as string | undefined) ?? "Failed to update password.");
          return;
        }

        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <AdminNav />

        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <div className="glass-panel rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Change password</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <PasswordField
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
            />
            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg">
                Password updated successfully.
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Update password"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white/60 text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
        placeholder="••••••••"
      />
    </label>
  );
}
