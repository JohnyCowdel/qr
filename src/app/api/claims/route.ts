import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEconomyRates } from "@/lib/economy";
import { calculateDistanceMeters } from "@/lib/geo";

const claimSchema = z.object({
  locationId: z.number().int().positive(),
  message: z.string().trim().max(240).optional().or(z.literal("")),
  latitude: z.number(),
  longitude: z.number(),
  accuracyM: z.number().positive().max(200).optional(),
});

export async function POST(request: Request) {
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
    select: {
      id: true, name: true, claimRadiusM: true, latitude: true, longitude: true,
      armor: true, currentPopulation: true, ownerTeamId: true,
      claims: {
        select: { userId: true, teamId: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
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
    select: { id: true, handle: true, power: true, teamId: true },
  });

  if (!user) {
    return Response.json({ ok: false, message: "User account not found." }, { status: 404 });
  }

  const builtRows = await db.builtBuilding.findMany({
    where: { locationId: location.id },
    select: {
      buildingDef: {
        select: {
          effectArm: true,
        },
      },
    },
  });
  const builtArmBonus = builtRows.reduce((sum, row) => sum + row.buildingDef.effectArm, 0);
  const effectiveArmor = location.armor + Math.floor(builtArmBonus);

  // Check if this user has an active revenge discount for this location
  const now = new Date();
  const [revengeDiscount, revengeSettings] = await Promise.all([
    db.revengeDiscount.findUnique({
      where: { locationId_userId: { locationId: location.id, userId: user.id } },
    }),
    db.adminSettings.findUnique({ where: { id: 1 }, select: { revengeDiscountHours: true } }),
  ]);
  const revengeDiscountHours = revengeSettings?.revengeDiscountHours ?? 8;
  const hasRevengeDiscount = revengeDiscount !== null && revengeDiscount.expiresAt > now;

  const claimCost = hasRevengeDiscount ? 0 : effectiveArmor + 1;
  if (!hasRevengeDiscount && user.power < claimCost) {
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

  const previousOwnerTeamId = location.ownerTeamId;
  const latestClaim = location.claims[0] ?? null;
  const previousOwnerUserId =
    previousOwnerTeamId !== null && latestClaim && latestClaim.teamId === previousOwnerTeamId
      ? latestClaim.userId
      : null;

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
      select: {
        createdAt: true,
        location: { select: { name: true } },
        team: { select: { name: true, emoji: true } },
      },
    });

    if (claimCost > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { power: { decrement: claimCost } },
      });
    }

    // Consume the revenge discount if it was used
    if (hasRevengeDiscount && revengeDiscount) {
      await tx.revengeDiscount.delete({
        where: { id: revengeDiscount.id },
      });
    }

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

    // If location was stolen from another player, grant them revenge discount.
    // But only if this claim was NOT itself a revenge reclaim – otherwise the
    // original thief would get a new discount and the ping-pong would never end.
    if (
      previousOwnerTeamId !== null &&
      previousOwnerUserId !== null &&
      previousOwnerUserId !== user.id &&
      !hasRevengeDiscount
    ) {
      const expiresAt = new Date(createdClaim.createdAt.getTime() + revengeDiscountHours * 60 * 60 * 1000);
      await tx.revengeDiscount.upsert({
        where: { locationId_userId: { locationId, userId: previousOwnerUserId } },
        create: { locationId, userId: previousOwnerUserId, expiresAt },
        update: { expiresAt },
      });
    }

    return createdClaim;
  });

  return Response.json({
    ok: true,
    message: `${user.handle} claimed ${claim.location.name} for ${claim.team.emoji} ${claim.team.name}.`,
    distanceM,
  });
}