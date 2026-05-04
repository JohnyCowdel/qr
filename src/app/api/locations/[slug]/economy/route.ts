import { z } from "zod";

import { after } from "next/server";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeWorkerSplit, runEconomyTick } from "@/lib/economy";

const schema = z.object({
  popToMoney: z.coerce.number().int().min(0),
  popToPower: z.coerce.number().int().min(0),
  popToPopulation: z.coerce.number().int().min(0),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json({ error: "Sign in required." }, { status: 401 });
  }

  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return Response.json({ error: "Invalid allocation payload." }, { status: 400 });
  }

  const { slug } = await params;
  after(() => runEconomyTick());

  const location = await db.location.findUnique({
    where: { slug },
    select: {
      id: true,
      ownerTeamId: true,
      currentPopulation: true,
      claims: {
        select: {
          userId: true,
          teamId: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!location) {
    return Response.json({ error: "Location not found." }, { status: 404 });
  }

  const latestClaim = location.claims[0];
  const ownerUserId =
    latestClaim && location.ownerTeamId !== null && latestClaim.teamId === location.ownerTeamId
      ? latestClaim.userId
      : null;
  if (!ownerUserId || ownerUserId !== userId) {
    return Response.json({ error: "Only the owning player can assign workers." }, { status: 403 });
  }

  const workers = normalizeWorkerSplit(location.currentPopulation, {
    money: payload.data.popToMoney,
    power: payload.data.popToPower,
    population: payload.data.popToPopulation,
  });

  const updated = await db.location.update({
    where: { id: location.id },
    data: {
      popToMoney: workers.money,
      popToPower: workers.power,
      popToPopulation: workers.population,
      workersUpdatedAt: new Date(),
      workersAutoStoppedAt: null,
    },
    select: {
      popToMoney: true,
      popToPower: true,
      popToPopulation: true,
      currentPopulation: true,
      workersAutoStoppedAt: true,
    },
  });

  return Response.json({ ok: true, allocation: updated });
}
