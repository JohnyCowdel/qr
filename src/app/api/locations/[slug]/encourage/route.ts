import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { calculateDistanceMeters } from "@/lib/geo";
import { validateGpsMovement } from "@/lib/gps-guard";
const encourageSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyM: z.number().positive().max(200).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json({ ok: false, message: "Přihlas se, abys mohl/a povzbudit lokaci." }, { status: 401 });
  }

  const payload = encourageSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return Response.json({ ok: false, message: "Neplatná GPS data." }, { status: 400 });
  }

  const { slug } = await params;
  const [user, location, settings] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, handle: true, power: true, teamId: true },
    }),
    db.location.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        claimRadiusM: true,
        latitude: true,
        longitude: true,
        ownerTeamId: true,
        claims: {
          select: { userId: true, teamId: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.adminSettings.findUnique({
      where: { id: 1 },
      select: { encourageCost: true, encourageArmorBonus: true },
    }),
  ]);

  const encourageCost = settings?.encourageCost ?? 10;
  const encourageArmorBonus = settings?.encourageArmorBonus ?? 5;

  if (!user) {
    return Response.json({ ok: false, message: "Uživatel nebyl nalezen." }, { status: 404 });
  }

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

  const gpsMovement = await validateGpsMovement(userId, latitude, longitude);
  if (!gpsMovement.ok) {
    return Response.json({ ok: false, message: gpsMovement.message }, { status: 400 });
  }

  const latestClaim = location.claims[0] ?? null;
  const ownerUserId =
    latestClaim && location.ownerTeamId !== null && latestClaim.teamId === location.ownerTeamId
      ? latestClaim.userId
      : null;

  if (location.ownerTeamId === null || ownerUserId === null) {
    return Response.json(
      { ok: false, message: "Povzbudit lze jen lokaci, která má aktivního vlastníka." },
      { status: 403 },
    );
  }

  if (user.teamId !== location.ownerTeamId) {
    return Response.json(
      { ok: false, message: "Povzbudit můžeš jen lokaci svého týmu." },
      { status: 403 },
    );
  }

  if (user.id === ownerUserId) {
    return Response.json(
      { ok: false, message: "Vlastní lokaci si sám/sama povzbudit nemůžeš." },
      { status: 403 },
    );
  }

  if (user.power < encourageCost) {
    return Response.json(
      {
        ok: false,
        message: `Nedostatečná síla. Potřebuješ ⚡ ${encourageCost}, máš ⚡ ${user.power.toFixed(2)}.`,
      },
      { status: 403 },
    );
  }

  const result = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.updateMany({
      where: {
        id: user.id,
        power: { gte: encourageCost },
      },
      data: {
        power: { decrement: encourageCost },
      },
    });

    if (updatedUser.count !== 1) {
      throw new Error("INSUFFICIENT_POWER");
    }

    return tx.location.update({
      where: { id: location.id },
      data: {
        armor: { increment: encourageArmorBonus },
      },
      select: { armor: true },
    });
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "INSUFFICIENT_POWER") {
      return null;
    }
    throw error;
  });

  if (!result) {
    return Response.json(
      { ok: false, message: "Síla se mezitím změnila. Zkus to znovu." },
      { status: 409 },
    );
  }

  return Response.json({
    ok: true,
    message: `${user.handle} povzbudil/a lokaci ${location.name}. Obrana +${encourageArmorBonus} za ⚡ ${encourageCost}.`,
    armor: result.armor,
    distanceM,
  });
}