"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AutoRefreshProps = {
  intervalMs?: number;
};

const MIN_REFRESH_INTERVAL_MS = 30_000;

export function AutoRefresh({ intervalMs = 30_000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const effectiveIntervalMs = Math.max(intervalMs, MIN_REFRESH_INTERVAL_MS);

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        return;
      }
      router.refresh();
    }, effectiveIntervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs, router]);

  return null;
}
