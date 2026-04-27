import { db } from "@/lib/db";
import { calculateMaxPopulation, calculateMinPopulation, roundDownPopulation } from "@/lib/location-population";
import {
  calculateLocationAreasSquareMeters,
  createRealmBorder,
  createRealmLocationPolygons,
  createRealmTileAssignments,
  smoothRealmLocationPolygons,
} from "@/lib/realm";

type CachedAreasEntry = {
  signature: string;
  areas: Record<string, number>;
};

let cachedAreasEntry: CachedAreasEntry | null = null;

function computeLocationAreas(locations: Array<{ id: string | number; latitude: number; longitude: number }>) {
  const realmBorder = createRealmBorder(
    locations.map((location) => ({
      latitude: location.latitude,
      longitude: location.longitude,
    })),
    1.2,
  );

  const tileAssignments = createRealmTileAssignments(
    locations.map((location) => ({
      id: String(location.id),
      latitude: location.latitude,
      longitude: location.longitude,
    })),
    realmBorder,
    100,
  );

  const rawPolygons = createRealmLocationPolygons(tileAssignments, realmBorder);
  const smoothedPolygons = smoothRealmLocationPolygons(rawPolygons, 2, 0.42);

  return calculateLocationAreasSquareMeters(smoothedPolygons);
}

function buildLocationsSignature(locations: Array<{ id: string | number; latitude: number; longitude: number }>) {
  return locations
    .map((location) => `${String(location.id)}:${location.latitude.toFixed(6)}:${location.longitude.toFixed(6)}`)
    .sort()
    .join("|");
}

function resolvePopulationFromArea(areaM2: number, currentPopulation: number) {
  const minPopulation = calculateMinPopulation(areaM2);
  const maxPopulation = calculateMaxPopulation(areaM2);

  return {
    minPopulation,
    maxPopulation,
    currentPopulation: Math.max(0, Math.min(maxPopulation, roundDownPopulation(currentPopulation))),
  };
}

export async function GET() {
  const locations = await db.location.findMany({
    select: {
      id: true, slug: true, name: true, type: true, armor: true, area: true,
      image: true, summary: true, latitude: true, longitude: true,
      claimRadiusM: true, currentPopulation: true, ownerTeamId: true,
      builtBuildings: {
        select: {
          buildingDef: { select: { effectArm: true } },
        },
      },
      claims: {
        select: {
          teamId: true,
          user: {
            select: {
              handle: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      ownerTeam: { select: { id: true, name: true, emoji: true, colorHex: true } },
    },
    orderBy: { name: "asc" },
  });

  const signature = buildLocationsSignature(locations);
  const computedAreas =
    cachedAreasEntry?.signature === signature
      ? cachedAreasEntry.areas
      : computeLocationAreas(locations);

  if (cachedAreasEntry?.signature !== signature) {
    cachedAreasEntry = { signature, areas: computedAreas };
  }

  return Response.json(
    locations.map((location) => {
      const area = Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area));
      const armorBonus = location.builtBuildings.reduce((sum, row) => sum + row.buildingDef.effectArm, 0);
      const latestClaim = location.claims[0] ?? null;
      const ownerUser =
        latestClaim && location.ownerTeamId !== null && latestClaim.teamId === location.ownerTeamId
          ? latestClaim.user
          : null;
      const { builtBuildings, claims, ...locationWithoutDerivedData } = location;
      return {
        ...locationWithoutDerivedData,
        ownerUser,
        area,
        armor: location.armor + Math.floor(armorBonus),
        ...resolvePopulationFromArea(area, location.currentPopulation),
      };
    }),
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}