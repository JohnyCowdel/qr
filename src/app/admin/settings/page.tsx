"use client";

import { useEffect, useState, useTransition } from "react";

import { AdminNav } from "@/components/admin-nav";

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [toggleSuccess, setToggleSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isTogglePending, startToggleTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/economy", { cache: "no-store" });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { registrationsOpen?: boolean };
        if (!cancelled) {
          setRegistrationsOpen(data.registrationsOpen ?? true);
        }
      } catch {
        // ignore initial load failure and keep default
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Nová hesla se neshodují.");
      return;
    }
    if (newPassword.length < 4) {
      setError("Nové heslo musí mít alespoň 4 znaky.");
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
          setError((data.error as string | undefined) ?? "Aktualizace hesla selhala.");
          return;
        }

        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch {
        setError("Chyba sítě. Zkus to znovu.");
      }
    });
  }

  function handleRegistrationToggle(nextOpen: boolean) {
    setToggleError(null);
    setToggleSuccess(null);

    startToggleTransition(async () => {
      try {
        const currentRes = await fetch("/api/admin/economy", { cache: "no-store" });
        if (!currentRes.ok) {
          setToggleError("Nepodařilo se načíst aktuální nastavení.");
          return;
        }

        const current = await currentRes.json();
        const res = await fetch("/api/admin/economy", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...current,
            registrationsOpen: nextOpen,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setToggleError(data?.error ?? "Uložení přepínače selhalo.");
          return;
        }

        setRegistrationsOpen(nextOpen);
        setToggleSuccess(nextOpen ? "Registrace byly otevřeny." : "Registrace byly uzavřeny.");
      } catch {
        setToggleError("Chyba sítě. Zkus to znovu.");
      }
    });
  }

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <AdminNav />

        <h1 className="text-2xl font-bold mb-6">Nastavení</h1>

        <div className="glass-panel rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Registrace</h2>
          <div className="mb-6 rounded-lg border border-[var(--line)] bg-white/60 p-4">
            <p className="text-sm text-[var(--muted)] mb-3">
              Přepínač ovládá dostupnost registrací pro nové hráče.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={isTogglePending || registrationsOpen}
                onClick={() => handleRegistrationToggle(true)}
                className="rounded-lg px-4 py-2 text-sm font-semibold border border-green-300 bg-green-50 text-green-800 disabled:opacity-50"
              >
                Otevřít registrace
              </button>
              <button
                type="button"
                disabled={isTogglePending || !registrationsOpen}
                onClick={() => handleRegistrationToggle(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold border border-red-300 bg-red-50 text-red-800 disabled:opacity-50"
              >
                Uzavřít registrace
              </button>
              <span className="text-sm font-medium">
                Stav: {registrationsOpen ? "otevřené" : "uzavřené"}
              </span>
            </div>

            {toggleError ? (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
                {toggleError}
              </p>
            ) : null}
            {toggleSuccess ? (
              <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-lg">
                {toggleSuccess}
              </p>
            ) : null}
          </div>

          <h2 className="text-lg font-semibold mb-4">Změnit heslo</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Současné heslo"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
            <PasswordField
              label="Nové heslo"
              value={newPassword}
              onChange={setNewPassword}
            />
            <PasswordField
              label="Potvrdit nové heslo"
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
                Heslo bylo úspěšně změněno.
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
            >
              {isPending ? "Ukládám…" : "Aktualizovat heslo"}
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
