import { ensureBuildingDefinitionsSeeded } from "@/lib/building-definitions";
import { db } from "@/lib/db";

export async function GET() {
  await ensureBuildingDefinitionsSeeded();

  const defs = await db.buildingDef.findMany({
    orderBy: [{ locationType: "asc" }, { svgKey: "asc" }],
  });

  return Response.json({ ok: true, buildings: defs });
}
