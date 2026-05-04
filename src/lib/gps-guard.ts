import { db } from "@/lib/db";
import { calculateDistanceMeters } from "@/lib/geo";

// 25 km/h = 6.94 m/s
const MAX_PLAUSIBLE_SPEED_MPS = 7;
const MIN_SECONDS_FOR_SPEED_CHECK = 10;

type LastGpsEvent = {
  latitude: number;
  longitude: number;
  createdAt: Date;
};

function pickLatestEvent(a: LastGpsEvent | null, b: LastGpsEvent | null): LastGpsEvent | null {
  if (!a) return b;
  if (!b) return a;
  return a.createdAt > b.createdAt ? a : b;
}

export async function validateGpsMovement(
  userId: number,
  latitude: number,
  longitude: number,
  now = new Date(),
) {
  const [lastClaim, lastGreeting] = await Promise.all([
    db.claim.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { latitude: true, longitude: true, createdAt: true },
    }),
    db.locationGreeting.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { latitude: true, longitude: true, createdAt: true },
    }),
  ]);

  const lastEvent = pickLatestEvent(lastClaim, lastGreeting);
  if (!lastEvent) {
    return { ok: true as const };
  }

  const elapsedSeconds = (now.getTime() - lastEvent.createdAt.getTime()) / 1000;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
    return { ok: true as const };
  }

  const travelDistanceM = calculateDistanceMeters(
    lastEvent.latitude,
    lastEvent.longitude,
    latitude,
    longitude,
  );

  if (elapsedSeconds >= MIN_SECONDS_FOR_SPEED_CHECK) {
    const speedMps = travelDistanceM / elapsedSeconds;
    if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) {
      return {
        ok: false as const,
        message: "GPS data působí neplatně (nepravděpodobná rychlost přesunu).",
      };
    }
  }

  return { ok: true as const };
}
