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

  const [buildingEffects, setBuildingEffects] = useState({ gpop: 0, pow: 0, maxpop: 0, mny: 0, arm: 0 });

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValuesRef = useRef<{ money: number; power: number; population: number } | null>(null);

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
        if (!response.ok) return;
        const data = (await response.json()) as {
          moneyRate: number;
          powerRate: number;
          populationRate: number;
        };
        if (canceled) return;
        setMoneyRate(data.moneyRate);
        setPowerRate(data.powerRate);
        setPopulationRate(data.populationRate);
      } catch {
        // Keep defaults if fetch fails.
      }
    }

    loadRates();

    // Re-fetch when the user returns to the tab so admin changes propagate.
    function onFocus() { void loadRates(); }
    window.addEventListener("focus", onFocus);

    return () => {
      canceled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    async function loadBuildingEffects() {
      try {
        const response = await fetch(`/api/locations/${slug}/buildings`, { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          ok: boolean;
          buildings?: Array<unknown>;
          currentEffects?: { gpop: number; pow: number; maxpop: number; mny: number; arm: number };
        };
        if (canceled) return;
        if (data.currentEffects) {
          setBuildingEffects(data.currentEffects);
        }
      } catch {
        // Keep defaults if fetch fails.
      }
    }

    loadBuildingEffects();

    // Re-fetch when the user returns to the tab so building changes propagate.
    function onFocus() { void loadBuildingEffects(); }
    function onBuildingsUpdated() { void loadBuildingEffects(); }
    window.addEventListener("focus", onFocus);
    window.addEventListener("buildings-updated", onBuildingsUpdated);

    return () => {
      canceled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("buildings-updated", onBuildingsUpdated);
    };
  }, [slug]);

  const assigned = useMemo(() => {
    return moneyWorkers + powerWorkers + populationWorkers;
  }, [moneyWorkers, populationWorkers, powerWorkers]);

  const totalWorkers = calculateWorkerCap(currentPopulationValue);
  const freeWorkers = Math.max(0, totalWorkers - assigned);

  const effectiveMoneyRate = moneyRate + buildingEffects.mny;
  const effectivePowerRate = powerRate + buildingEffects.pow;
  const effectivePopulationRate = populationRate + buildingEffects.gpop;

  const moneyPerDay = moneyWorkers * effectiveMoneyRate;
  const powerPerDay = powerWorkers * effectivePowerRate;
  const growthFactor = populationWorkers / 30;
  const populationPerDay = Math.max(
    0,
    effectivePopulationRate * growthFactor * currentPopulationValue * (1 - currentPopulationValue / Math.max(1, maxPopulation)),
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

  function schedulePersist(values: { money: number; power: number; population: number }) {
    pendingValuesRef.current = values;
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (pendingValuesRef.current) {
        void persist(pendingValuesRef.current);
        pendingValuesRef.current = null;
      }
    }, 600);
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

      schedulePersist({ money, power, population });
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
    schedulePersist({ money, power, population });
  }

  function ResourceRow({
    emoji,
    label,
    workers,
    growth,
    atMax,
    onPlus,
    onMinus,
  }: {
    emoji: string;
    label: string;
    workers: number;
    growth: number;
    atMax?: boolean;
    onPlus: () => void;
    onMinus: () => void;
  }) {
    return (
      <div className={`rounded-xl border p-2.5 sm:p-3${atMax ? " border-red-300 bg-red-50" : " border-[var(--line)] bg-white/70"}`}>
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div>
            <p className={`text-sm font-semibold leading-tight${atMax ? " text-red-600" : ""}`}>{emoji} {label}</p>
            <p className="text-xs text-[var(--muted)]">⬆️ {Number.isInteger(growth) ? growth : growth.toFixed(2)} / den</p>
            {atMax && <p className="mt-0.5 text-xs italic text-red-500">Populace na maximu</p>}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onMinus}
              disabled={workers <= 0}
              className="h-7 w-7 rounded-full border border-[var(--line)] bg-white text-base font-bold hover:bg-[var(--background-strong)] disabled:opacity-50 sm:h-8 sm:w-8"
            >
              -
            </button>
            <div className="w-8 text-center text-sm font-semibold sm:w-10">{workers}</div>
            <button
              type="button"
              onClick={onPlus}
              disabled={false}
              className="h-7 w-7 rounded-full border border-[var(--line)] bg-white text-base font-bold hover:bg-[var(--background-strong)] disabled:opacity-50 sm:h-8 sm:w-8"
            >
              +
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="glass-panel rounded-[24px] border border-[var(--line)] p-4 sm:rounded-[28px] sm:p-5">
      <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">Přiřazení zdrojů</h2>

      <div className="mt-2.5 grid gap-2 sm:mt-3 sm:grid-cols-3">
        <div className={`rounded-xl border px-3 py-2 text-sm${Math.floor(currentPopulationValue) >= maxPopulation ? " border-red-300 bg-red-50" : " border-[var(--line)] bg-white/70"}`}>
          👷 celkem: <span className={`font-semibold${Math.floor(currentPopulationValue) >= maxPopulation ? " text-red-600" : ""}`}>{totalWorkers}</span>
          {Math.floor(currentPopulationValue) >= maxPopulation && (
            <p className="mt-0.5 text-xs italic text-red-500">Populace na maximu</p>
          )}
           / 🪏 pracují: <span className="font-semibold">{assigned}</span>
        </div>
      </div>

      <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-3">
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
          atMax={Math.floor(currentPopulationValue) >= maxPopulation}
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
