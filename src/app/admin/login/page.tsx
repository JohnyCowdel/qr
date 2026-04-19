"use client";

import { useState, useTransition } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError((data.error as string | undefined) ?? "Přihlášení selhalo.");
          return;
        }

        window.location.href = "/admin";
      } catch {
        setError("Chyba sítě. Zkus to znovu.");
      }
    });
  }

  return (
    <main className="terrain-grid min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="glass-panel rounded-2xl p-8">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
            Territory QR
          </p>
          <h1 className="text-2xl font-bold mb-6">Přihlášení správce</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
                Heslo
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                className="w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white/60 text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
            >
              {isPending ? "Ověřuji…" : "Přihlásit se"}
            </button>
          </form>

          <p className="mt-4 text-xs text-[var(--muted)] text-center">
            Výchozí heslo: <span className="font-mono">admin</span>
          </p>
        </div>
      </div>
    </main>
  );
}
