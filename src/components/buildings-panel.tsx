"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type BuildingItem = {
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
  isBuilt: boolean;
  builtAt: string | null;
};

type Props = {
  slug: string;
  canManage: boolean;
};

function formatEffect(label: string, value: number) {
  return `${label}: ${value.toFixed(2)}`;
}

export function BuildingsPanel({ slug, canManage }: Props) {
  const [items, setItems] = useState<BuildingItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    try {
      const res = await fetch(`/api/locations/${slug}/buildings`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Nepodařilo se načíst budovy.");
      }

      const data = (await res.json()) as { ok: boolean; buildings: BuildingItem[] };
      setItems(data.buildings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se načíst budovy.");
    }
  }

  useEffect(() => {
    void load();
  }, [slug]);

  const builtCount = useMemo(() => items.filter((x) => x.isBuilt).length, [items]);

  function build(buildingDefId: number) {
    setError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/locations/${slug}/buildings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingDefId }),
        });

        const data = (await res.json()) as { ok: boolean; message?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? "Stavba se nezdařila.");
        }

        setStatus(data.message ?? "Postaveno.");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Stavba se nezdařila.");
      }
    });
  }

  return (
    <section className="glass-panel rounded-[28px] border border-[var(--line)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">Budovy</h2>
          <p className="text-sm text-[var(--muted)]">Obsazeno {builtCount}/{items.length} slotů</p>
        </div>
      </div>

      {status ? <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{item.name}</div>
                <div className="text-xs text-[var(--muted)]">{item.svgKey}</div>
              </div>
              <div className="text-sm font-medium">{item.isBuilt ? "Postaveno" : `${item.cost.toFixed(0)} $`}</div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span>{formatEffect("mny", item.effectMny)}</span>
              <span>{formatEffect("pow", item.effectPow)}</span>
              <span>{formatEffect("gpop", item.effectGpop)}</span>
              <span>{formatEffect("maxpop", item.effectMaxpop)}</span>
              <span>{formatEffect("arm", item.effectArm)}</span>
            </div>

            {canManage && !item.isBuilt ? (
              <button
                type="button"
                onClick={() => build(item.id)}
                disabled={isPending}
                className="mt-3 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
              >
                Postavit
              </button>
            ) : null}
          </div>
        ))}

        {!items.length ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] bg-white/60 p-3 text-sm text-[var(--muted)]">
            Pro tento typ lokace nejsou dostupné žádné budovy.
          </div>
        ) : null}
      </div>
    </section>
  );
}
