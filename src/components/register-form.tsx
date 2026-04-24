"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type TeamOption = {
  id: number;
  name: string;
  colorHex: string;
  emoji: string;
  users: Array<{
    id: number;
    handle: string;
    power: number;
  }>;
};

type RegisterFormProps = {
  teams: TeamOption[];
};

function formatPower(power: number) {
  return power.toFixed(2);
}

export function RegisterForm({ teams }: RegisterFormProps) {
  const [handle, setHandle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState(18);
  const [password, setPassword] = useState("");
  const [teamId, setTeamId] = useState<number>(teams[0]?.id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle, firstName, lastName, email, age, password, teamId }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setError(data?.error ?? "Registrace selhala.");
          return;
        }

        window.location.href = "/auth/login?pending=1";
      } catch {
        setError("Chyba sítě. Zkus to znovu.");
      }
    });
  }

  return (
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Jméno</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
            placeholder="Jan"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Příjmení</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
            placeholder="Novak"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
          placeholder="player@example.com"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Věk</span>
        <input
          type="number"
          min={6}
          max={120}
          value={age}
          onChange={(e) => setAge(Number(e.target.value) || 0)}
          required
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Heslo</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
          placeholder="Alespoň 6 znaků"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Tým</span>
        <select
          value={teamId}
          onChange={(e) => setTeamId(Number(e.target.value))}
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.emoji} {team.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-2 rounded-xl border border-[var(--line)] bg-white/55 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Členové týmů
        </p>
        {teams.map((team) => {
          const isSelected = team.id === teamId;

          return (
            <details
              key={team.id}
              className={`rounded-lg border px-3 py-2 ${isSelected ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--line)] bg-white/70"}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.colorHex }} />
                  {team.emoji} {team.name}
                </span>
                <span className="text-xs text-[var(--muted)]">{team.users.length} hráčů</span>
              </summary>

              <div className="mt-2 space-y-1 border-t border-[var(--line)] pt-2">
                {team.users.length ? (
                  team.users.map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium">@{member.handle}</span>
                      <span className="font-mono text-[var(--muted)]">⚡ {formatPower(member.power)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--muted)]">Tým zatím nemá schválené hráče.</p>
                )}
              </div>
            </details>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !teamId}
        className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
      >
        {isPending ? "Vytvářím účet..." : "Vytvořit účet"}
      </button>

      <p className="text-sm text-[var(--muted)]">
        Už máš účet? <Link href="/auth/login" className="font-semibold text-[var(--accent-strong)]">Přihlásit se</Link>
      </p>

      <p className="text-xs text-[var(--muted)]">
        Registrace vyžaduje schválení správcem před prvním přihlášením.
      </p>
    </form>
  );
}
