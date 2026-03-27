import { db } from "@/lib/db";

export async function GET() {
  const locations = await db.location.findMany({
    include: {
      ownerTeam: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return Response.json(locations);
}