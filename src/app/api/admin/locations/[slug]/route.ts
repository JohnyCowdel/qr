import { z } from "zod";

import { db } from "@/lib/db";
import { LOCATION_TYPES } from "@/lib/location-types";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  type: z.enum(LOCATION_TYPES).optional(),
  area: z.coerce.number().int().positive().optional(),
  image: z.string().trim().min(1).max(32).optional(),
  summary: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  latitude: z.coerce.number().finite().optional(),
  longitude: z.coerce.number().finite().optional(),
  claimRadiusM: z.coerce.number().int().positive().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const location = await db.location.findUnique({
    where: { slug },
    include: { ownerTeam: true },
  });
  if (!location) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(location);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const location = await db.location.update({ where: { slug }, data: parsed.data });
    return Response.json(location);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const loc = await db.location.findUnique({ where: { slug }, select: { id: true } });
  if (!loc) return Response.json({ error: "Not found" }, { status: 404 });

  await db.$transaction([
    db.claim.deleteMany({ where: { locationId: loc.id } }),
    db.location.delete({ where: { slug } }),
  ]);
  return new Response(null, { status: 204 });
}
