"use client";

import { useState, useTransition } from "react";

export function DailyRewardButton({
  lastDailyClaimAt,
  power,
  dailyReward,
}: {
  lastDailyClaimAt: string | null;
  power: number;
  dailyReward: number;
}) {
  const alreadyClaimed =
    !!lastDailyClaimAt &&
    Date.now() - new Date(lastDailyClaimAt).getTime() < 24 * 60 * 60 * 1000;

  const powerTooHigh = power >= dailyReward;

  const [claimed, setClaimed] = useState(false);
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (alreadyClaimed && !claimed) {
    return (
      <button
        disabled
        className="rounded-full border border-[var(--line)] bg-white/40 px-4 py-2 text-sm font-semibold text-[var(--muted)] cursor-not-allowed"
      >
        Odměna vyzvednuta ✓
      </button>
    );
  }

  if (powerTooHigh && !claimed) {
    return (
      <button
        disabled
        className="rounded-full border border-[var(--line)] bg-white/40 px-4 py-2 text-sm font-semibold text-[var(--muted)] cursor-not-allowed"
        title={`Odměna je jen pro hráče s méně než ${dailyReward} síly`}
      >
        Odměna nedostupná 🔒
      </button>
    );
  }

  if (claimed) {
    return (
      <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
        +{reward} síly přijato! 🎁
      </span>
    );
  }

  function handleClaim() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/daily-reward", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setReward((data as { reward: number }).reward);
          setClaimed(true);
        } else {
          setError((data as { error?: string }).error ?? "Chyba při vyzvednutí odměny.");
        }
      } catch {
        setError("Síťová chyba. Zkus to znovu.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClaim}
        disabled={isPending}
        className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
      >
        {isPending ? "…" : "Vyzvednout odměnu 🎁"}
      </button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
