import { db } from "@/lib/db";
import { runEconomyTick } from "@/lib/economy";
import { deriveLocationPopulation } from "@/lib/location-population";
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
  await runEconomyTick();

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
        user: {
          select: {
            id: true,
            handle: true,
            avatarType: true,
            avatarSprite: true,
            avatarSeed: true,
            avatarPhotoDataUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
    db.team.findMany({
      include: {
        ownedLocations: true,
        users: true,
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
    ...deriveLocationPopulation(
      Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area)),
      location.currentPopulation,
    ),
  }));

  return {
    locations: locationsWithComputedAreas,
    recentClaims: recentClaims.map((claim) => ({
      ...claim,
      createdAt: claim.createdAt.toISOString(),
    })),
    teamSummary: teams
      .map((team) => ({
        slug: team.slug,
        name: team.name,
        colorHex: team.colorHex,
        playerPower: team.users.reduce((sum, user) => sum + user.power, 0),
        claimedCount: team.ownedLocations.length,
      }))
      .sort((a, b) => b.playerPower - a.playerPower),
    totalTeamPower: teams.reduce((sum, team) => sum + team.power, 0),
    totalPlayerPower: teams.reduce((sum, team) => sum + team.users.reduce((s, user) => s + user.power, 0), 0),
  };
}

export async function getLocationPageData(slug: string) {
  await runEconomyTick();

  const [location, allLocations] = await Promise.all([
    db.location.findUnique({
      where: { slug },
      include: {
        ownerTeam: true,
        claims: {
          include: {
            team: true,
            user: {
              select: {
                id: true,
                handle: true,
                avatarType: true,
                avatarSprite: true,
                avatarSeed: true,
                avatarPhotoDataUrl: true,
              },
            },
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

  const computedAreas = computeLocationAreas(allLocations);
  const computedArea = Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area));
  const mapLocations = allLocations.map((mapLocation) => ({
    ...deriveLocationPopulation(
      Math.max(1, Math.round(computedAreas[String(mapLocation.id)] ?? mapLocation.area)),
      mapLocation.currentPopulation,
    ),
    id: mapLocation.id,
    slug: mapLocation.slug,
    name: mapLocation.name,
    type: mapLocation.type,
    armor: mapLocation.armor,
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
      ownerUser: location.claims[0]?.user ?? null,
      ...deriveLocationPopulation(computedArea, location.currentPopulation),
      lastClaimedAt: location.lastClaimedAt?.toISOString() ?? null,
      claims: location.claims.map((claim) => ({
        ...claim,
        createdAt: claim.createdAt.toISOString(),
      })),
    },
    mapLocations,
  };
}