"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { calculateWorkerCap } from "@/lib/location-population";

type Props = {
  slug: string;
  currentPopulation: number;
  maxPopulation: number;
  popToMoney: number;
  popToPower: number;
  popToPopulation: number;
};

export function LocationEconomyControls({
  slug,
  currentPopulation,
  maxPopulation,
  popToMoney,
  popToPower,
  popToPopulation,
}: Props) {
  const [moneyWorkers, setMoneyWorkers] = useState(popToMoney);
  const [powerWorkers, setPowerWorkers] = useState(popToPower);
  const [populationWorkers, setPopulationWorkers] = useState(popToPopulation);
  const [currentPopulationValue, setCurrentPopulationValue] = useState(currentPopulation);

  const [moneyRate, setMoneyRate] = useState(0.5);
  const [powerRate, setPowerRate] = useState(0.5);
  const [populationRate, setPopulationRate] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);

  useEffect(() => {
    setMoneyWorkers(popToMoney);
    setPowerWorkers(popToPower);
    setPopulationWorkers(popToPopulation);
  }, [popToMoney, popToPopulation, popToPower]);

  useEffect(() => {
    setCurrentPopulationValue(currentPopulation);
  }, [currentPopulation]);

  useEffect(() => {
    let canceled = false;

    async function loadRates() {
      try {
        const response = await fetch("/api/admin/economy", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          moneyRate: number;
          powerRate: number;
          populationRate: number;
        };

        if (canceled) {
          return;
        }

        setMoneyRate(data.moneyRate);
        setPowerRate(data.powerRate);
        setPopulationRate(data.populationRate);
      } catch {
        // Keep defaults if fetch fails.
      }
    }

    loadRates();
    return () => {
      canceled = true;
    };
  }, []);

  const assigned = useMemo(() => {
    return moneyWorkers + powerWorkers + populationWorkers;
  }, [moneyWorkers, populationWorkers, powerWorkers]);

  const totalWorkers = calculateWorkerCap(currentPopulationValue);
  const freeWorkers = Math.max(0, totalWorkers - assigned);

  const moneyPerDay = moneyWorkers * moneyRate;
  const powerPerDay = powerWorkers * powerRate;
  const growthFactor = populationWorkers / 30;
  const populationPerDay = Math.max(
    0,
    populationRate * growthFactor * currentPopulationValue * (1 - currentPopulationValue / Math.max(1, maxPopulation)),
  );

  async function persist(next: { money: number; power: number; population: number }) {
    const requestId = ++requestIdRef.current;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/locations/${slug}/economy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            popToMoney: next.money,
            popToPower: next.power,
            popToPopulation: next.population,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data.error as string | undefined) ?? "Aktualizace pracovníků selhala.");
          return;
        }

        if (requestId !== requestIdRef.current) {
          return;
        }

        setMoneyWorkers(Number(data.allocation?.popToMoney ?? next.money));
        setPowerWorkers(Number(data.allocation?.popToPower ?? next.power));
        setPopulationWorkers(Number(data.allocation?.popToPopulation ?? next.population));
        if (typeof data.allocation?.currentPopulation === "number" && Number.isFinite(data.allocation.currentPopulation)) {
          setCurrentPopulationValue(data.allocation.currentPopulation);
        }
      } catch {
        setError("Chyba sítě. Zkus to znovu.");
      }
    });
  }

  function adjustWorkers(target: "money" | "power" | "population", delta: 1 | -1) {
    let money = moneyWorkers;
    let power = powerWorkers;
    let population = populationWorkers;

    if (delta === -1) {
      if (target === "money" && money > 0) {
        money -= 1;
      } else if (target === "power" && power > 0) {
        power -= 1;
      } else if (target === "population" && population > 0) {
        population -= 1;
      } else {
        return;
      }

      void persist({ money, power, population });
      setMoneyWorkers(money);
      setPowerWorkers(power);
      setPopulationWorkers(population);
      return;
    }

    if (assigned < totalWorkers) {
      if (target === "money") money += 1;
      if (target === "power") power += 1;
      if (target === "population") population += 1;
    } else {
      const rerouteOrder: Record<typeof target, Array<"money" | "power" | "population">> = {
        money: ["power", "population"],
        power: ["money", "population"],
        population: ["money", "power"],
      };

      let moved = false;
      for (const source of rerouteOrder[target]) {
        if (source === "money" && money > 0) {
          money -= 1;
          moved = true;
          break;
        }
        if (source === "power" && power > 0) {
          power -= 1;
          moved = true;
          break;
        }
        if (source === "population" && population > 0) {
          population -= 1;
          moved = true;
          break;
        }
      }

      if (!moved) {
        return;
      }

      if (target === "money") money += 1;
      if (target === "power") power += 1;
      if (target === "population") population += 1;
    }

    setMoneyWorkers(money);
    setPowerWorkers(power);
    setPopulationWorkers(population);
    void persist({ money, power, population });
  }

  function ResourceRow({
    emoji,
    label,
    workers,
    growth,
    onPlus,
    onMinus,
  }: {
    emoji: string;
    label: string;
    workers: number;
    growth: number;
    onPlus: () => void;
    onMinus: () => void;
  }) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{emoji} {label}</p>
            <p className="text-xs text-[var(--muted)]">⬆️ {growth.toFixed(2)} / day</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMinus}
              disabled={isPending || workers <= 0}
              className="h-8 w-8 rounded-full border border-[var(--line)] bg-white text-base font-bold hover:bg-[var(--background-strong)] disabled:opacity-50"
            >
              -
            </button>
            <div className="w-10 text-center text-sm font-semibold">{workers}</div>
            <button
              type="button"
              onClick={onPlus}
              disabled={isPending}
              className="h-8 w-8 rounded-full border border-[var(--line)] bg-white text-base font-bold hover:bg-[var(--background-strong)] disabled:opacity-50"
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="glass-panel rounded-[28px] border border-[var(--line)] p-5">
      <h2 className="text-2xl font-semibold tracking-[-0.03em]">Přiřazení zdrojů</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Použij +/- pro přiřazení pracovníků. Změny se ukládají okamžitě.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-sm">
          Aktuální pracovníci: <span className="font-semibold">{totalWorkers}</span>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-sm">
          Přiřazeno: <span className="font-semibold">{assigned}</span>
        </div>
        <div className="rounded-xl border border-[var(--line)] bg-white/70 px-3 py-2 text-sm">
          Volní pracovníci: <span className="font-semibold">{freeWorkers}</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ResourceRow
          emoji="💰"
          label="Peníze"
          workers={moneyWorkers}
          growth={moneyPerDay}
          onPlus={() => adjustWorkers("money", 1)}
          onMinus={() => adjustWorkers("money", -1)}
        />
        <ResourceRow
          emoji="💪"
          label="Síla"
          workers={powerWorkers}
          growth={powerPerDay}
          onPlus={() => adjustWorkers("power", 1)}
          onMinus={() => adjustWorkers("power", -1)}
        />
        <ResourceRow
          emoji="👨‍🌾"
          label="Populace"
          workers={populationWorkers}
          growth={populationPerDay}
          onPlus={() => adjustWorkers("population", 1)}
          onMinus={() => adjustWorkers("population", -1)}
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
    </section>
  );
}
