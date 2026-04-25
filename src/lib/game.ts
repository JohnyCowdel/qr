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

export async function getHomePageData() {
  const [locations, recentClaims, teams, claimCounts] = await Promise.all([
    db.location.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        armor: true,
        area: true,
        image: true,
        summary: true,
        latitude: true,
        longitude: true,
        claimRadiusM: true,
        currentPopulation: true,
        lastClaimedAt: true,
        ownerTeamId: true,
        ownerTeam: {
          select: { id: true, name: true, emoji: true, colorHex: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.claim.findMany({
      select: {
        id: true,
        message: true,
        createdAt: true,
        distanceM: true,
        location: {
          select: {
            id: true,
            slug: true,
            name: true,
            image: true,
          },
        },
        team: {
          select: { id: true, name: true, emoji: true, colorHex: true },
        },
        user: {
          select: {
            id: true,
            handle: true,
            avatarType: true,
            avatarSprite: true,
            avatarSeed: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.team.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        emoji: true,
        colorHex: true,
        power: true,
        ownedLocations: { select: { id: true } },
        users: {
          where: { isApproved: true },
          select: {
            id: true,
            handle: true,
            power: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.claim.groupBy({
      by: ["userId"],
      _count: true,
    }),
  ]);

  const computedAreas = computeLocationAreas(locations);
  const locationsWithComputedAreas = locations.map((location) => ({
    ...location,
    area: Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area)),
    ...resolvePopulationFromArea(
      Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area)),
      location.currentPopulation,
    ),
  }));

  const claimCountByUserId = Object.fromEntries(
    claimCounts.map((row) => [row.userId, row._count]),
  );

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
        emoji: team.emoji,
        colorHex: team.colorHex,
        playerPower: team.users.reduce((sum, user) => sum + user.power, 0),
        claimedCount: team.ownedLocations.length,
        users: team.users
          .map((user) => ({
            id: user.id,
            handle: user.handle,
            power: user.power,
            claimCount: claimCountByUserId[user.id] ?? 0,
          }))
          .sort((a, b) => b.power - a.power),
      }))
      .sort((a, b) => b.playerPower - a.playerPower),
    totalTeamPower: teams.reduce((sum, team) => sum + team.power, 0),
    totalPlayerPower: teams.reduce((sum, team) => sum + team.users.reduce((s, user) => s + user.power, 0), 0),
  };
}

export async function getLocationPageData(slug: string) {
  const [location, allLocations] = await Promise.all([
    db.location.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        image: true,
        summary: true,
        content: true,
        area: true,
        armor: true,
        latitude: true,
        longitude: true,
        claimRadiusM: true,
        currentPopulation: true,
        popToMoney: true,
        popToPower: true,
        popToPopulation: true,
        lastClaimedAt: true,
        ownerTeamId: true,
        ownerTeam: {
          select: { id: true, name: true, emoji: true, colorHex: true },
        },
        claims: {
          select: {
            id: true,
            message: true,
            createdAt: true,
            distanceM: true,
            teamId: true,
            team: {
              select: { id: true, name: true, emoji: true, colorHex: true },
            },
            user: {
              select: {
                id: true,
                handle: true,
                avatarType: true,
                avatarSprite: true,
                avatarSeed: true,
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
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        armor: true,
        area: true,
        image: true,
        summary: true,
        latitude: true,
        longitude: true,
        claimRadiusM: true,
        currentPopulation: true,
        ownerTeamId: true,
        ownerTeam: {
          select: { id: true, name: true, emoji: true, colorHex: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!location) {
    return null;
  }

  const computedAreas = computeLocationAreas(allLocations);
  const computedArea = Math.max(1, Math.round(computedAreas[String(location.id)] ?? location.area));
  const mapLocations = allLocations.map((mapLocation) => ({
    ...resolvePopulationFromArea(
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

  const locationOwnerClaim =
    location.ownerTeamId !== null && location.claims[0]?.teamId === location.ownerTeamId
      ? location.claims[0]
      : null;

  return {
    location: {
      ...location,
      area: computedArea,
      ownerUser: locationOwnerClaim?.user ?? null,
      ...resolvePopulationFromArea(computedArea, location.currentPopulation),
      lastClaimedAt: location.lastClaimedAt?.toISOString() ?? null,
      claims: location.claims.map((claim) => ({
        ...claim,
        createdAt: claim.createdAt.toISOString(),
      })),
    },
    mapLocations,
  };
}