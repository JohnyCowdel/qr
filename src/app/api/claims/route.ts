import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEconomyRates, runEconomyTick } from "@/lib/economy";
import { calculateDistanceMeters } from "@/lib/geo";

const claimSchema = z.object({
  locationId: z.number().int().positive(),
  message: z.string().trim().max(240).optional().or(z.literal("")),
  latitude: z.number(),
  longitude: z.number(),
  accuracyM: z.number().positive().max(200).optional(),
});

export async function POST(request: Request) {
  await runEconomyTick();

  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json(
      { ok: false, message: "Sign in is required before claiming a location." },
      { status: 401 },
    );
  }

  const payload = claimSchema.safeParse(await request.json());

  if (!payload.success) {
    return Response.json(
      { ok: false, message: "Claim payload is invalid." },
      { status: 400 },
    );
  }

  const { locationId, message, latitude, longitude, accuracyM } = payload.data;

  const location = await db.location.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    return Response.json({ ok: false, message: "Location not found." }, { status: 404 });
  }

  if (accuracyM && accuracyM > Math.max(location.claimRadiusM, 65)) {
    return Response.json(
      {
        ok: false,
        message: "GPS accuracy is too low. Move into open space and try again.",
      },
      { status: 400 },
    );
  }

  const distanceM = calculateDistanceMeters(
    latitude,
    longitude,
    location.latitude,
    location.longitude,
  );

  if (distanceM > location.claimRadiusM) {
    return Response.json(
      {
        ok: false,
        message: `Příliš daleko od ${location.name}.`,
        distanceM,
      },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: { team: true },
  });

  if (!user) {
    return Response.json({ ok: false, message: "User account not found." }, { status: 404 });
  }

  const claimCost = location.armor + 1;
  if (user.power < claimCost) {
    return Response.json(
      {
        ok: false,
        message: `Nedostatečná síla. Potřebuješ ⚡ ${claimCost}, máš ⚡ ${user.power.toFixed(2)}.`,
      },
      { status: 403 },
    );
  }

  const teamId = user.teamId;
  const rates = await getEconomyRates();
  const lossRatio = Math.max(0, Math.min(1, rates.claimPopulationLossPercent / 100));
  const reducedPopulation = Math.max(
    rates.claimPopulationMin,
    location.currentPopulation * (1 - lossRatio),
  );

  const claim = await db.$transaction(async (tx) => {
    const createdClaim = await tx.claim.create({
      data: {
        locationId,
        teamId,
        userId: user.id,
        message: message?.trim() || null,
        latitude,
        longitude,
        accuracyM: accuracyM ?? null,
        distanceM,
      },
      include: {
        team: true,
        user: true,
        location: true,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { power: { decrement: claimCost } },
    });

    await tx.location.update({
      where: { id: locationId },
      data: {
        ownerTeamId: teamId,
        lastClaimedAt: createdClaim.createdAt,
        currentPopulation: reducedPopulation,
        popToMoney: 0,
        popToPower: 0,
        popToPopulation: 30,
        workersUpdatedAt: createdClaim.createdAt,
        workersAutoStoppedAt: null,
        economyUpdatedAt: createdClaim.createdAt,
      },
    });

    return createdClaim;
  });

  return Response.json({
    ok: true,
    message: `${user.handle} claimed ${claim.location.name} for ${claim.team.name}.`,
    distanceM,
  });
}