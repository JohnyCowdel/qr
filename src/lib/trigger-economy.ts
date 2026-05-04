/**
 * Fire-and-forget trigger for the economy tick.
 * Calls /api/cron/economy as a separate serverless invocation so the
 * caller's lambda can finish without waiting for the tick to complete.
 *
 * Use inside after() callbacks on pages:
 *   after(() => triggerEconomyTick())
 */
export function triggerEconomyTick(): void {
  const base =
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:" + (process.env.PORT ?? "5000");

  const secret = process.env.CRON_SECRET ?? "internal";
  const url = `${base}/api/cron/economy`;

  // Intentionally not awaited — we don't care about the result.
  void fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  }).catch(() => {
    // Silently ignore network errors — tick will run on the next page load.
  });
}
