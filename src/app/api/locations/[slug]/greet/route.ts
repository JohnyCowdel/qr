import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateDistanceMeters } from "@/lib/geo";

const greetSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracyM: z.number().positive().max(200).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json({ ok: false, message: "Přihlas se, abys mohl/a pozdravit lokaci." }, { status: 401 });
  }

  const payload = greetSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return Response.json({ ok: false, message: "Neplatná GPS data." }, { status: 400 });
  }

  const { slug } = await params;
  const location = await db.location.findUnique({
    where: { slug },
    select: { id: true, name: true, latitude: true, longitude: true, claimRadiusM: true },
  });

  if (!location) {
    return Response.json({ ok: false, message: "Lokace nebyla nalezena." }, { status: 404 });
  }

  const { latitude, longitude, accuracyM } = payload.data;
  if (accuracyM && accuracyM > Math.max(location.claimRadiusM, 65)) {
    return Response.json(
      { ok: false, message: "GPS přesnost je příliš nízká. Zkus to venku znovu." },
      { status: 400 },
    );
  }

  const distanceM = calculateDistanceMeters(latitude, longitude, location.latitude, location.longitude);
  if (distanceM > location.claimRadiusM) {
    return Response.json(
      { ok: false, message: `Příliš daleko od ${location.name}.`, distanceM },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, handle: true },
  });

  if (!user) {
    return Response.json({ ok: false, message: "Uživatel nebyl nalezen." }, { status: 404 });
  }

  const greeting = await db.locationGreeting.create({
    data: {
      locationId: location.id,
      userId: user.id,
      latitude,
      longitude,
      accuracyM: accuracyM ?? null,
      distanceM,
    },
    select: { createdAt: true },
  });

  return Response.json({
    ok: true,
    message: `${user.handle} pozdravil/a lokaci ${location.name}.`,
    distanceM,
    createdAt: greeting.createdAt.toISOString(),
  });
}