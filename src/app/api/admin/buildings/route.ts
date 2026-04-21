import { db } from "@/lib/db";

export async function GET() {
  const defs = await db.buildingDef.findMany({
    orderBy: [{ locationType: "asc" }, { svgKey: "asc" }],
  });

  return Response.json({ ok: true, buildings: defs });
}
