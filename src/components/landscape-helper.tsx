"use client";

import { useMemo, useState } from "react";

type LockableOrientation = {
  lock?: (orientation: "landscape") => Promise<void>;
};

function getLockableOrientation(): LockableOrientation | null {
  if (typeof window === "undefined") {
    return null;
  }

  const orientation = (screen as Screen & { orientation?: LockableOrientation }).orientation;
  return orientation ?? null;
}

export function LandscapeHelper() {
  const [message, setMessage] = useState<string | null>(null);

  const lockSupported = useMemo(() => {
    const orientation = getLockableOrientation();
    return typeof orientation?.lock === "function";
  }, []);

  async function tryLandscapeMode() {
    setMessage(null);

    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }

      const orientation = getLockableOrientation();
      if (typeof orientation?.lock === "function") {
        await orientation.lock("landscape");
        setMessage("Landscape režim aktivní.");
        return;
      }

      setMessage("Tvůj prohlížeč nepodporuje zamknutí orientace. Otoč telefon ručně.");
    } catch {
      setMessage("Nepodařilo se zapnout landscape režim. Otoč telefon ručně.");
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <p className="text-sm text-[var(--muted)]">
          Pro přesnější editaci budov je na mobilu lepší režim na šířku.
        </p>
        <button
          type="button"
          onClick={() => void tryLandscapeMode()}
          className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-[var(--background-strong)]"
        >
          Režim na šířku
        </button>
      </div>
      {!lockSupported ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Zamknutí orientace nemusí být dostupné ve všech prohlížečích.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-xs text-[var(--muted)]">{message}</p> : null}
    </div>
  );
}
