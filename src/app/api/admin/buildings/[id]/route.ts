import { z } from "zod";

import { db } from "@/lib/db";

type PageProps = { params: Promise<{ id: string }> };

const schema = z.object({
  cost: z.coerce.number().min(0),
  effectGpop: z.coerce.number().min(0),
  effectPow: z.coerce.number().min(0),
  effectMaxpop: z.coerce.number().min(0),
  effectMny: z.coerce.number().min(0),
  effectArm: z.coerce.number().min(0),
});

export async function PUT(request: Request, { params }: PageProps) {
  const { id } = await params;
  const buildingId = parseInt(id, 10);
  if (!Number.isInteger(buildingId) || buildingId <= 0) {
    return Response.json({ ok: false, message: "Invalid id." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ ok: false, message: "Invalid payload." }, { status: 400 });
  }

  const updated = await db.buildingDef.update({
    where: { id: buildingId },
    data: parsed.data,
  });

  return Response.json({ ok: true, building: updated });
}
