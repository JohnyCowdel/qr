import { db } from "@/lib/db";

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

  return {
    locations,
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
  const location = await db.location.findUnique({
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
  });

  if (!location) {
    return null;
  }

  const teams = await db.team.findMany({
    orderBy: {
      name: "asc",
    },
  });

  return {
    location: {
      ...location,
      lastClaimedAt: location.lastClaimedAt?.toISOString() ?? null,
      claims: location.claims.map((claim) => ({
        ...claim,
        createdAt: claim.createdAt.toISOString(),
      })),
    },
    teams,
  };
}