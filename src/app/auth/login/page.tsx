"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

export default function UserLoginPage() {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "admin@qrempire.space";
  const [pendingNotice, setPendingNotice] = useState(false);
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const pending = new URLSearchParams(window.location.search).get("pending") === "1";
    setPendingNotice(pending);
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle, password }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Přihlášení selhalo.");
          return;
        }

        window.location.href = "/me";
      } catch {
        setError("Chyba sítě. Zkus to znovu.");
      }
    });
  }

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <section className="glass-panel rounded-[28px] border border-[var(--line)] p-6 sm:p-7">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">Territory QR</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Přihlásit se</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Přihlaš se ke svému profilu hráče a zabirávej lokace.
          </p>

          {pendingNotice ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Registrace proběhla. Čekej na schválení správcem, poté se přihlaš.
            </p>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Přezdívka</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
                placeholder="User1234"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Heslo</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {isPending ? "Přihlašuji..." : "Přihlásit se"}
            </button>
          </form>

          <p className="mt-4 text-sm text-[var(--muted)]">
            Nový hráč? <Link href="/auth/register" className="font-semibold text-[var(--accent-strong)]">Vytvořit účet</Link>
          </p>

          <p className="mt-2 text-sm text-[var(--muted)]">
            Zapomněl/a jsi heslo? Kontaktuj správce na{" "}
            <a href={`mailto:${adminEmail}`} className="font-semibold text-[var(--accent-strong)] hover:underline">
              {adminEmail}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
