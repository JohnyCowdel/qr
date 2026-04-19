import { z } from "zod";

import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  moneyRate: z.coerce.number().min(0).max(100),
  powerRate: z.coerce.number().min(0).max(100),
  populationRate: z.coerce.number().min(0).max(100),
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
    },
    select: {
      moneyRate: true,
      powerRate: true,
      populationRate: true,
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
    },
  });

  return Response.json({ ok: true, rates: updated });
}
