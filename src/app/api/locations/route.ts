import { db } from "@/lib/db";
import { calculateMaxPopulation, calculateMinPopulation, roundDownPopulation } from "@/lib/location-population";
import {
  calculateLocationAreasSquareMeters,
  createRealmBorder,
  createRealmLocationPolygons,
  createRealmTileAssignments,
  smoothRealmLocationPolygons,
} from "@/lib/realm";

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
      ownerTeam: { select: { id: true, name: true, emoji: true, colorHex: true } },
    },
    orderBy: { name: "asc" },
  });

  const computedAreas = computeLocationAreas(locations);

  return Response.json(
    locations.map((location) => {
      const area = Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area));
      return {
        ...location,
        area,
        ...resolvePopulationFromArea(area, location.currentPopulation),
      };
    }),
  );
}