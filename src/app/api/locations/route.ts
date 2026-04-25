import { db } from "@/lib/db";

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

  return Response.json(locations);
}