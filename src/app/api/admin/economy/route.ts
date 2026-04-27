import { z } from "zod";

import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  moneyRate: z.coerce.number().min(0).max(10000),
  powerRate: z.coerce.number().min(0).max(10000),
  populationRate: z.coerce.number().min(0).max(10000),
  claimPopulationLossPercent: z.coerce.number().min(0).max(100),
  claimPopulationMin: z.coerce.number().int().min(0).max(100000),
  productionTimeoutHours: z.coerce.number().min(0).max(10000),
  dailyLoginReward: z.coerce.number().min(0).max(10000),
  revengeDiscountHours: z.coerce.number().min(0).max(10000),
  encourageCost: z.coerce.number().min(0).max(10000),
  encourageArmorBonus: z.coerce.number().min(0).max(10000),
});

export async function GET() {
  const settings = await db.adminSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      passwordHash: hashPassword("admin"),
      moneyRate: 0.5,
      powerRate: 0.5,
      populationRate: 1,
      claimPopulationLossPercent: 25,
      claimPopulationMin: 3,
      productionTimeoutHours: 24,
      dailyLoginReward: 8,
      revengeDiscountHours: 8,
      encourageCost: 10,
      encourageArmorBonus: 5,
    },
    select: {
      moneyRate: true,
      powerRate: true,
      populationRate: true,
      claimPopulationLossPercent: true,
      claimPopulationMin: true,
      productionTimeoutHours: true,
      dailyLoginReward: true,
      revengeDiscountHours: true,
      encourageCost: true,
      encourageArmorBonus: true,
    },
  });

  return Response.json(settings);
}

export async function PUT(request: Request) {
  const payload = schema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return Response.json({ error: "Invalid economy rates." }, { status: 400 });
  }

  const updated = await db.adminSettings.upsert({
    where: { id: 1 },
    update: payload.data,
    create: {
      id: 1,
      passwordHash: hashPassword("admin"),
      ...payload.data,
    },
    select: {
      moneyRate: true,
      powerRate: true,
      populationRate: true,
      claimPopulationLossPercent: true,
      claimPopulationMin: true,
      productionTimeoutHours: true,
      dailyLoginReward: true,
      revengeDiscountHours: true,
      encourageCost: true,
      encourageArmorBonus: true,
    },
  });

  return Response.json({ ok: true, rates: updated });
}
