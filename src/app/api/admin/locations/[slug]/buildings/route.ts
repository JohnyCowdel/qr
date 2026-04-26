import { z } from "zod";

import { db } from "@/lib/db";

type PageProps = { params: Promise<{ slug: string }> };

const deleteSchema = z.object({
  buildingDefId: z.number().int().positive(),
});

/** GET /api/admin/locations/[slug]/buildings
 *  Returns all built buildings for the given location.
 */
export async function GET(
  _request: Request,
  { params }: PageProps,
) {
  const { slug } = await params;

  const location = await db.location.findUnique({
    where: { slug },
    select: {
      id: true,
      builtBuildings: {
        select: {
          id: true,
          buildingDefId: true,
          createdAt: true,
          buildingDef: { select: { name: true, svgKey: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!location) {
    return Response.json({ error: "Lokace nenalezena." }, { status: 404 });
  }

  return Response.json({
    ok: true,
    buildings: location.builtBuildings.map((b) => ({
      id: b.id,
      buildingDefId: b.buildingDefId,
      name: b.buildingDef.name,
      svgKey: b.buildingDef.svgKey,
      createdAt: b.createdAt,
    })),
  });
}

/** DELETE /api/admin/locations/[slug]/buildings
 *  Removes a built building from the location by buildingDefId.
 */
export async function DELETE(
  request: Request,
  { params }: PageProps,
) {
  const { slug } = await params;

  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const location = await db.location.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!location) {
    return Response.json({ error: "Lokace nenalezena." }, { status: 404 });
  }

  const deleted = await db.builtBuilding.deleteMany({
    where: {
      locationId: location.id,
      buildingDefId: parsed.data.buildingDefId,
    },
  });

  if (deleted.count === 0) {
    return Response.json({ error: "Budova nenalezena." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
