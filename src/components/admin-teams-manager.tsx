"use client";

import { useState, useTransition } from "react";

type Team = {
  id: number;
  slug: string;
  name: string;
  colorHex: string;
  emoji: string;
  isHidden: boolean;
  power: number;
  _count: { users: number };
};

type Draft = {
  name: string;
  colorHex: string;
  emoji: string;
  isHidden: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  colorHex: "#4a7c59",
  emoji: "🏴",
  isHidden: false,
};

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border border-black/10 shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function TeamRow({
  team,
  onSave,
  onDelete,
}: {
  team: Team;
  onSave: (id: number, data: Draft) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: team.name,
    colorHex: team.colorHex,
    emoji: team.emoji,
    isHidden: team.isHidden,
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await onSave(team.id, draft);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při ukládání.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Smazat tým "${team.emoji} ${team.name}"? Tato akce je nevratná.`)) return;
    startTransition(async () => {
      try {
        await onDelete(team.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při mazání.");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white/60 px-4 py-3">
        <span className="text-xl w-7 text-center">{team.emoji}</span>
        <ColorDot color={team.colorHex} />
        <span className="flex-1 font-medium">{team.emoji} {team.name}</span>
        <span className="text-xs text-[var(--muted)] font-mono">{team._count.users} hráčů</span>
        {team.isHidden && (
          <span className="rounded-full bg-yellow-100 border border-yellow-300 px-2 py-0.5 text-xs text-yellow-700 font-medium">
            skrytý
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--background-strong)] transition-colors"
        >
          Upravit
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--accent)] bg-white/80 p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Název
          </span>
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Emoji
          </span>
          <input
            value={draft.emoji}
            onChange={(e) => set("emoji", e.target.value.slice(0, 8))}
            className="w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            placeholder="🏴"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Barva
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.colorHex}
              onChange={(e) => set("colorHex", e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-[var(--line)] p-0.5"
            />
            <input
              value={draft.colorHex}
              onChange={(e) => set("colorHex", e.target.value)}
              className="flex-1 rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
              placeholder="#4a7c59"
            />
          </div>
        </label>
        <label className="flex items-center gap-2 cursor-pointer pt-5">
          <input
            type="checkbox"
            checked={draft.isHidden}
            onChange={(e) => set("isHidden", e.target.checked)}
            className="accent-[var(--accent)] h-4 w-4"
          />
          <span className="text-sm">
            Skrytý tým{" "}
            <span className="text-xs text-[var(--muted)]">(nezobrazuje se při registraci)</span>
          </span>
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !draft.name.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Ukládám…" : "Uložit"}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setDraft({ name: team.name, colorHex: team.colorHex, emoji: team.emoji, isHidden: team.isHidden }); }}
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--background-strong)] transition-colors"
        >
          Zrušit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || team._count.users > 0}
          title={team._count.users > 0 ? "Nelze smazat tým s hráči" : "Smazat tým"}
          className="ml-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
        >
          Smazat
        </button>
      </div>
    </div>
  );
}

function NewTeamForm({ onCreate }: { onCreate: (data: Draft) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        await onCreate(draft);
        setDraft(EMPTY_DRAFT);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při vytváření.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--accent)] px-4 py-3 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors w-full"
      >
        <span className="text-lg">+</span> Nový tým
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--accent)] bg-white/80 p-4 space-y-3">
      <p className="text-sm font-semibold">Nový tým</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Název</span>
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            placeholder="Červené lišky"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Emoji</span>
          <input
            value={draft.emoji}
            onChange={(e) => set("emoji", e.target.value.slice(0, 8))}
            className="w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
            placeholder="🏴"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Barva</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.colorHex}
              onChange={(e) => set("colorHex", e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-[var(--line)] p-0.5"
            />
            <input
              value={draft.colorHex}
              onChange={(e) => set("colorHex", e.target.value)}
              className="flex-1 rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--accent)]"
              placeholder="#4a7c59"
            />
          </div>
        </label>
        <label className="flex items-center gap-2 cursor-pointer pt-5">
          <input
            type="checkbox"
            checked={draft.isHidden}
            onChange={(e) => set("isHidden", e.target.checked)}
            className="accent-[var(--accent)] h-4 w-4"
          />
          <span className="text-sm">
            Skrytý tým{" "}
            <span className="text-xs text-[var(--muted)]">(nezobrazuje se při registraci)</span>
          </span>
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || !draft.name.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-50 transition-colors"
        >
          {isPending ? "Vytvářím…" : "Vytvořit"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setDraft(EMPTY_DRAFT); }}
          className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--background-strong)] transition-colors"
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}

export function AdminTeamsManager({ initialTeams }: { initialTeams: Team[] }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(id: number, data: Draft) {
    const res = await fetch(`/api/admin/teams/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Chyba ${res.status}`);
    }
    const updated = (await res.json()) as Team;
    setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Chyba ${res.status}`);
    }
    setTeams((ts) => ts.filter((t) => t.id !== id));
  }

  async function handleCreate(data: Draft) {
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Chyba ${res.status}`);
    }
    const created = (await res.json()) as Team;
    setTeams((ts) => [...ts, { ...created, _count: { users: 0 } }].sort((a, b) => a.name.localeCompare(b.name)));
    setError(null);
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {teams.map((team) => (
        <TeamRow key={team.id} team={team} onSave={handleSave} onDelete={handleDelete} />
      ))}

      {teams.length === 0 && (
        <p className="text-sm text-[var(--muted)] text-center py-8">Žádné týmy.</p>
      )}

      <NewTeamForm onCreate={handleCreate} />
    </div>
  );
}
