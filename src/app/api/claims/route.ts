import { z } from "zod";

import { db } from "@/lib/db";
import { calculateDistanceMeters } from "@/lib/geo";

const claimSchema = z.object({
  locationId: z.number().int().positive(),
  handle: z.string().trim().min(2).max(32),
  teamId: z.number().int().positive(),
  message: z.string().trim().max(240).optional().or(z.literal("")),
  latitude: z.number(),
  longitude: z.number(),
  accuracyM: z.number().positive().max(200).optional(),
});

export async function POST(request: Request) {
  const payload = claimSchema.safeParse(await request.json());

  if (!payload.success) {
    return Response.json(
      { ok: false, message: "Claim payload is invalid." },
      { status: 400 },
    );
  }

  const { locationId, handle, teamId, message, latitude, longitude, accuracyM } = payload.data;

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
        message: `Too far away from ${location.name}.`,
        distanceM,
      },
      { status: 400 },
    );
  }

  const team = await db.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    return Response.json({ ok: false, message: "Team not found." }, { status: 404 });
  }

  const user = await db.user.upsert({
    where: { handle },
    create: {
      handle,
      teamId,
    },
    update: {
      teamId,
    },
  });

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

    await tx.location.update({
      where: { id: locationId },
      data: {
        ownerTeamId: teamId,
        lastClaimedAt: createdClaim.createdAt,
      },
    });

    return createdClaim;
  });

  return Response.json({
    ok: true,
    message: `${claim.user.handle} claimed ${claim.location.name} for ${claim.team.name}.`,
    distanceM,
  });
}