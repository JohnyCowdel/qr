import { db } from "@/lib/db";
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

export async function getHomePageData() {
  const [locations, recentClaims, teams] = await Promise.all([
    db.location.findMany({
      include: {
        ownerTeam: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    db.claim.findMany({
      include: {
        location: true,
        team: true,
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
    db.team.findMany({
      include: {
        ownedLocations: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const computedAreas = computeLocationAreas(locations);
  const locationsWithComputedAreas = locations.map((location) => ({
    ...location,
    area: Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area)),
  }));

  return {
    locations: locationsWithComputedAreas,
    recentClaims: recentClaims.map((claim) => ({
      ...claim,
      createdAt: claim.createdAt.toISOString(),
    })),
    teamSummary: teams.map((team) => ({
      slug: team.slug,
      name: team.name,
      colorHex: team.colorHex,
      claimedCount: team.ownedLocations.length,
    })),
  };
}

export async function getLocationPageData(slug: string) {
  const [location, allLocations] = await Promise.all([
    db.location.findUnique({
      where: { slug },
      include: {
        ownerTeam: true,
        claims: {
          include: {
            team: true,
            user: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
        },
      },
    }),
    db.location.findMany({
      include: {
        ownerTeam: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  if (!location) {
    return null;
  }

  const teams = await db.team.findMany({
    orderBy: {
      name: "asc",
    },
  });

  const computedAreas = computeLocationAreas(allLocations);
  const computedArea = Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area));
  const mapLocations = allLocations.map((mapLocation) => ({
    id: mapLocation.id,
    slug: mapLocation.slug,
    name: mapLocation.name,
    type: mapLocation.type,
    power: mapLocation.power,
    area: Math.max(1, Math.round(computedAreas[String(mapLocation.id)] ?? mapLocation.area)),
    image: mapLocation.image,
    summary: mapLocation.summary,
    latitude: mapLocation.latitude,
    longitude: mapLocation.longitude,
    claimRadiusM: mapLocation.claimRadiusM,
    ownerTeam: mapLocation.ownerTeam,
  }));

  return {
    location: {
      ...location,
      area: computedArea,
      lastClaimedAt: location.lastClaimedAt?.toISOString() ?? null,
      claims: location.claims.map((claim) => ({
        ...claim,
        createdAt: claim.createdAt.toISOString(),
      })),
    },
    mapLocations,
    teams,
  };
}