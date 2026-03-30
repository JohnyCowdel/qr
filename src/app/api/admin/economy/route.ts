import { z } from "zod";

import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  moneyRate: z.coerce.number().min(0).max(100),
  powerRate: z.coerce.number().min(0).max(100),
  populationRate: z.coerce.number().min(0).max(100),
});

export async function GET() {
  const existing = await db.adminSettings.findUnique({
    where: { id: 1 },
    select: {
      moneyRate: true,
      powerRate: true,
      populationRate: true,
    },
  });

  if (existing) {
    return Response.json(existing);
  }

  const settings = await db.adminSettings.create({
    data: {
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

  const existing = await db.adminSettings.findUnique({ where: { id: 1 }, select: { id: true } });

  const updated = existing
    ? await db.adminSettings.update({
        where: { id: 1 },
        data: payload.data,
        select: {
          moneyRate: true,
          powerRate: true,
          populationRate: true,
        },
      })
    : await db.adminSettings.create({
        data: {
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
