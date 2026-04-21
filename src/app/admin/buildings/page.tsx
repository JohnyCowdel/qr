"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { AdminNav } from "@/components/admin-nav";

type BuildingRow = {
  id: number;
  name: string;
  svgKey: string;
  locationType: string;
  cost: number;
  effectGpop: number;
  effectPow: number;
  effectMaxpop: number;
  effectMny: number;
  effectArm: number;
};

export default function AdminBuildingsPage() {
  const [rows, setRows] = useState<BuildingRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const res = await fetch("/api/admin/buildings", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Nepodařilo se načíst budovy.");
        }

        const data = (await res.json()) as { ok: boolean; buildings: BuildingRow[] };
        if (!canceled) {
          setRows(data.buildings);
        }
      } catch (e) {
        if (!canceled) {
          setError(e instanceof Error ? e.message : "Nepodařilo se načíst budovy.");
        }
      }
    }

    load();
    return () => {
      canceled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, BuildingRow[]>>((acc, row) => {
      acc[row.locationType] ??= [];
      acc[row.locationType].push(row);
      return acc;
    }, {});
  }, [rows]);

  function updateRow(id: number, patch: Partial<BuildingRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function saveRow(row: BuildingRow) {
    setError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/buildings/${row.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cost: row.cost,
            effectGpop: row.effectGpop,
            effectPow: row.effectPow,
            effectMaxpop: row.effectMaxpop,
            effectMny: row.effectMny,
            effectArm: row.effectArm,
          }),
        });

        if (!res.ok) {
          throw new Error("Uložení se nezdařilo.");
        }

        setStatus(`Uloženo: ${row.name}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Uložení se nezdařilo.");
      }
    });
  }

  return (
    <main className="terrain-grid min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl rounded-[28px] border border-[var(--line)] bg-white/80 p-6 shadow-sm sm:p-8">
        <AdminNav />

        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Budovy</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Nastavení efektů a ceny pro všechny typy budov. Efekty se propisují do ekonomiky per lokaci.
          </p>
        </div>

        {status ? <p className="mb-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{status}</p> : null}
        {error ? <p className="mb-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        <div className="space-y-6">
          {Object.entries(grouped).map(([locationType, items]) => (
            <section key={locationType} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <h2 className="mb-3 text-lg font-semibold uppercase tracking-wide text-[var(--muted)]">{locationType}</h2>

              <div className="mb-2 hidden gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] lg:grid lg:grid-cols-[1.3fr_repeat(6,minmax(0,1fr))_auto]">
                <div>Budova</div>
                <div>Cena ($)</div>
                <div>👨‍🌾 Růst populace</div>
                <div>💪 Růst síly</div>
                <div>🏘️ Max. populace</div>
                <div>💰 Růst peněz</div>
                <div>🛡️ Obrana</div>
                <div>Akce</div>
              </div>

              <div className="space-y-3">
                {items.map((row) => (
                  <div key={row.id} className="grid gap-2 rounded-xl border border-[var(--line)] bg-white p-3 lg:grid-cols-[1.3fr_repeat(6,minmax(0,1fr))_auto]">
                    <div>
                      <div className="text-sm font-semibold">{row.name}</div>
                      <div className="text-xs text-[var(--muted)]">{row.svgKey}</div>
                    </div>

                    <input className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm" type="number" step="0.1" value={row.cost} onChange={(e) => updateRow(row.id, { cost: Number(e.target.value) })} title="Cena" />
                    <input className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm" type="number" step="0.1" value={row.effectGpop} onChange={(e) => updateRow(row.id, { effectGpop: Number(e.target.value) })} title="gpop" />
                    <input className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm" type="number" step="0.1" value={row.effectPow} onChange={(e) => updateRow(row.id, { effectPow: Number(e.target.value) })} title="pow" />
                    <input className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm" type="number" step="0.1" value={row.effectMaxpop} onChange={(e) => updateRow(row.id, { effectMaxpop: Number(e.target.value) })} title="maxpop" />
                    <input className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm" type="number" step="0.1" value={row.effectMny} onChange={(e) => updateRow(row.id, { effectMny: Number(e.target.value) })} title="mny" />
                    <input className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm" type="number" step="0.1" value={row.effectArm} onChange={(e) => updateRow(row.id, { effectArm: Number(e.target.value) })} title="arm" />

                    <button
                      type="button"
                      onClick={() => saveRow(row)}
                      disabled={isPending}
                      className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
                    >
                      Uložit
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
