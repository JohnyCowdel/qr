import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { runEconomyTick } from "@/lib/economy";

type PageProps = { params: Promise<{ slug: string }> };

function resolveBuildingCatalogType(locationType: string): "camp" | "mine" | "town" | null {
  const type = String(locationType || "").trim().toLowerCase();

  if (type === "camp" || type === "camp1") {
    return "camp";
  }

  if (type === "mine" || type === "mine1") {
    return "mine";
  }

  if (type === "town" || type === "fortress" || type === "settlement") {
    return "town";
  }

  // tower currently has no building catalog
  return null;
}

function acceptedDefLocationTypes(catalogType: "camp" | "mine" | "town") {
  if (catalogType === "camp") {
    return ["camp", "camp1"];
  }

  if (catalogType === "mine") {
    return ["mine", "mine1"];
  }

  return ["town", "settlement", "fortress"];
}

function isBuildingDefCompatible(defLocationType: string, catalogType: "camp" | "mine" | "town") {
  const normalized = String(defLocationType || "").trim().toLowerCase();
  return acceptedDefLocationTypes(catalogType).includes(normalized);
}

/** GET /api/locations/[slug]/buildings
 *  Returns all building defs for this location's type, annotated with isBuilt / builtAt.
 */
export async function GET(request: Request, { params }: PageProps) {
  const { slug } = await params;

  const location = await db.location.findUnique({
    where: { slug },
    select: {
      id: true,
      type: true,
      builtBuildings: {
        select: {
          buildingDefId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!location) {
    return Response.json({ ok: false, message: "Location not found." }, { status: 404 });
  }

  const catalogType = resolveBuildingCatalogType(location.type);
  if (!catalogType) {
    return Response.json({ ok: true, buildings: [] });
  }

  const defs = await db.buildingDef.findMany({
    where: {
      OR: acceptedDefLocationTypes(catalogType).map((typeValue) => ({
        locationType: {
          equals: typeValue,
          mode: "insensitive",
        },
      })),
    },
    orderBy: { svgKey: "asc" },
  });

  const builtMap = new Map(location.builtBuildings.map((b) => [b.buildingDefId, b.createdAt]));

  return Response.json({
    ok: true,
    buildings: defs.map((def) => ({
      id: def.id,
      name: def.name,
      svgKey: def.svgKey,
      locationType: def.locationType,
      cost: def.cost,
      effectGpop: def.effectGpop,
      effectPow: def.effectPow,
      effectMaxpop: def.effectMaxpop,
      effectMny: def.effectMny,
      effectArm: def.effectArm,
      isBuilt: builtMap.has(def.id),
      builtAt: builtMap.get(def.id)?.toISOString() ?? null,
    })),
  });
}

const buySchema = z.object({ buildingDefId: z.number().int().positive() });

/** POST /api/locations/[slug]/buildings
 *  Requires auth. User must be current owner. Deducts cost from money. Creates BuiltBuilding.
 */
export async function POST(request: Request, { params }: PageProps) {
  await runEconomyTick();

  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json({ ok: false, message: "Přihlášení je vyžadováno." }, { status: 401 });
  }

  const { slug } = await params;

  const parsed = buySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ ok: false, message: "Neplatný požadavek." }, { status: 400 });
  }

  const { buildingDefId } = parsed.data;

  const location = await db.location.findUnique({
    where: { slug },
    select: {
      id: true,
      type: true,
      ownerTeamId: true,
      claims: {
        select: { userId: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      builtBuildings: {
        where: { buildingDefId },
        select: { id: true },
      },
    },
  });

  if (!location) {
    return Response.json({ ok: false, message: "Lokace nenalezena." }, { status: 404 });
  }

  const catalogType = resolveBuildingCatalogType(location.type);
  if (!catalogType) {
    return Response.json({ ok: false, message: "Tento typ lokace nepodporuje budovy." }, { status: 400 });
  }

  const ownerUserId = location.claims[0]?.userId;
  if (ownerUserId !== userId) {
    return Response.json({ ok: false, message: "Tuto lokaci nevlastníš." }, { status: 403 });
  }

  if (location.builtBuildings.length > 0) {
    return Response.json({ ok: false, message: "Budova zde již stojí." }, { status: 409 });
  }

  const def = await db.buildingDef.findUnique({ where: { id: buildingDefId } });
  if (!def || !isBuildingDefCompatible(def.locationType, catalogType)) {
    return Response.json({ ok: false, message: "Tato budova zde nemůže stát." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { money: true } });
  if (!user || user.money < def.cost) {
    return Response.json(
      { ok: false, message: `Nedostatek zlatých. Potřebuješ ${def.cost.toFixed(0)}, máš ${(user?.money ?? 0).toFixed(2)}.` },
      { status: 403 },
    );
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { money: { decrement: def.cost } } });
    await tx.builtBuilding.create({ data: { locationId: location.id, buildingDefId } });
  });

  return Response.json({ ok: true, message: `${def.name} postavena.` });
}
