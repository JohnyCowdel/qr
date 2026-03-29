"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type TeamOption = {
  id: number;
  name: string;
  colorHex: string;
};

type RegisterFormProps = {
  teams: TeamOption[];
};

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
          setError(data?.error ?? "Registration failed.");
          return;
        }

        window.location.href = "/auth/login?pending=1";
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <form className="mt-5 space-y-4" onSubmit={submit}>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Handle</span>
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
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Name</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
            placeholder="Jan"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Surname</span>
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
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Email</span>
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
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Age</span>
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
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
          placeholder="At least 6 characters"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Team</span>
        <select
          value={teamId}
          onChange={(e) => setTeamId(Number(e.target.value))}
          className="w-full rounded-xl border border-[var(--line)] bg-white/80 px-3 py-2 outline-none focus:border-[var(--accent)]"
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-2">
        {teams.map((team) => (
          <span
            key={team.id}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-xs"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.colorHex }} />
            {team.name}
          </span>
        ))}
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
        {isPending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-sm text-[var(--muted)]">
        Already registered? <Link href="/auth/login" className="font-semibold text-[var(--accent-strong)]">Sign in</Link>
      </p>

      <p className="text-xs text-[var(--muted)]">
        Registration requires admin approval before your first sign in.
      </p>
    </form>
  );
}
