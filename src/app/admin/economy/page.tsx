"use client";

import { useEffect, useState, useTransition } from "react";

import { AdminNav } from "@/components/admin-nav";

export default function AdminEconomyPage() {
  const [moneyRate, setMoneyRate] = useState("0.5");
  const [powerRate, setPowerRate] = useState("0.5");
  const [populationRate, setPopulationRate] = useState("1");
  const [claimPopulationLossPercent, setClaimPopulationLossPercent] = useState("25");
  const [claimPopulationMin, setClaimPopulationMin] = useState("3");
  const [productionTimeoutHours, setProductionTimeoutHours] = useState("24");
  const [dailyLoginReward, setDailyLoginReward] = useState("8");
  const [revengeDiscountHours, setRevengeDiscountHours] = useState("8");
  const [encourageCost, setEncourageCost] = useState("10");
  const [encourageArmorBonus, setEncourageArmorBonus] = useState("5");
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
          claimPopulationLossPercent: number;
          claimPopulationMin: number;
          productionTimeoutHours: number;
          dailyLoginReward: number;
          revengeDiscountHours: number;
          encourageCost: number;
          encourageArmorBonus: number;
        };

        if (canceled) {
          return;
        }

        setMoneyRate(String(data.moneyRate));
        setPowerRate(String(data.powerRate));
        setPopulationRate(String(data.populationRate));
        setClaimPopulationLossPercent(String(data.claimPopulationLossPercent));
        setClaimPopulationMin(String(data.claimPopulationMin));
        setProductionTimeoutHours(String(data.productionTimeoutHours));
        setDailyLoginReward(String(data.dailyLoginReward));
        setRevengeDiscountHours(String(data.revengeDiscountHours));
        setEncourageCost(String(data.encourageCost));
        setEncourageArmorBonus(String(data.encourageArmorBonus));
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
            claimPopulationLossPercent: Number(claimPopulationLossPercent),
            claimPopulationMin: Number(claimPopulationMin),
            productionTimeoutHours: Number(productionTimeoutHours),
            dailyLoginReward: Number(dailyLoginReward),
            revengeDiscountHours: Number(revengeDiscountHours),
            encourageCost: Number(encourageCost),
            encourageArmorBonus: Number(encourageArmorBonus),
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
        <p className="mb-6 text-sm text-[var(--muted)]">
          Zde také nastavíš, o kolik procent se při každém záboru okamžitě sníží populace lokace a jaký je absolutní minimální limit.
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

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Odběr populace při záboru (%)
                </span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={claimPopulationLossPercent}
                  onChange={(e) => setClaimPopulationLossPercent(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Minimální populace po záboru
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={claimPopulationMin}
                  onChange={(e) => setClaimPopulationMin(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Timeout neaktivity výroby (hodiny)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={productionTimeoutHours}
                  onChange={(e) => setProductionTimeoutHours(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Denní odměna za přihlášení (síla)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={dailyLoginReward}
                  onChange={(e) => setDailyLoginReward(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Sleva pomsty – platnost (hodiny)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={revengeDiscountHours}
                  onChange={(e) => setRevengeDiscountHours(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Povzbudit – cena (síla)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={encourageCost}
                  onChange={(e) => setEncourageCost(e.target.value)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Povzbudit – bonus obrany
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={encourageArmorBonus}
                  onChange={(e) => setEncourageArmorBonus(e.target.value)}
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