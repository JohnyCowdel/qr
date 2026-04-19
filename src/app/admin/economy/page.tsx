"use client";

import { useEffect, useState, useTransition } from "react";

import { AdminNav } from "@/components/admin-nav";

export default function AdminEconomyPage() {
  const [moneyRate, setMoneyRate] = useState("0.5");
  const [powerRate, setPowerRate] = useState("0.5");
  const [populationRate, setPopulationRate] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let canceled = false;

    async function loadRates() {
      try {
        const res = await fetch("/api/admin/economy", { cache: "no-store" });
        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as {
          moneyRate: number;
          powerRate: number;
          populationRate: number;
        };

        if (canceled) {
          return;
        }

        setMoneyRate(String(data.moneyRate));
        setPowerRate(String(data.powerRate));
        setPopulationRate(String(data.populationRate));
      } catch {
        // keep defaults on fetch failure
      }
    }

    loadRates();
    return () => {
      canceled = true;
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/economy", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moneyRate: Number(moneyRate),
            powerRate: Number(powerRate),
            populationRate: Number(populationRate),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError((data.error as string | undefined) ?? "Failed to save economy settings.");
          return;
        }

        setSuccess(true);
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <AdminNav />

        <h1 className="mb-2 text-2xl font-bold">Ekonomika</h1>
        <p className="mb-6 text-sm text-[var(--muted)]">
          Nastav, jak rychle každý přiřazený pracovník generuje peníze, sílu a růst populace.
        </p>

        <div className="glass-panel rounded-xl p-6">
          <h2 className="mb-4 text-lg font-semibold">Sazby nárůstu</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Peňíze / pop / den
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={moneyRate}
                  onChange={(e) => setMoneyRate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Síla / pop / den
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={powerRate}
                  onChange={(e) => setPowerRate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Pop growth rate
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={populationRate}
                  onChange={(e) => setPopulationRate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
                Economy settings updated.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save increase rates"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}