import { db } from "@/lib/db";

type BuildingDefinitionSeed = {
  name: string;
  svgKey: string;
  locationType: "camp" | "mine" | "town";
  effectGpop: number;
  effectPow: number;
  effectMaxpop: number;
  effectMny: number;
  effectArm: number;
  cost: number;
};

const DEFAULT_BUILDING_DEFS: BuildingDefinitionSeed[] = [
  // camp1
  { name: "Ohniště", svgKey: "building1", locationType: "camp", effectGpop: 2, effectPow: 2, effectMaxpop: 0, effectMny: 0, effectArm: 2, cost: 60 },
  { name: "Palisáda", svgKey: "building2", locationType: "camp", effectGpop: 0, effectPow: 0, effectMaxpop: 5, effectMny: 0, effectArm: 10, cost: 150 },
  { name: "Koželužna", svgKey: "building3", locationType: "camp", effectGpop: 0, effectPow: 1, effectMaxpop: 0, effectMny: 2, effectArm: 0, cost: 30 },
  { name: "Koňské Teepee", svgKey: "building4", locationType: "camp", effectGpop: 1, effectPow: 1, effectMaxpop: 5, effectMny: 0, effectArm: 0, cost: 70 },
  { name: "Medvědovo Teepee", svgKey: "building5", locationType: "camp", effectGpop: 1, effectPow: 1, effectMaxpop: 5, effectMny: 0, effectArm: 0, cost: 70 },
  { name: "Hlavní Teepee", svgKey: "building6", locationType: "camp", effectGpop: 1, effectPow: 1, effectMaxpop: 5, effectMny: 0, effectArm: 0, cost: 70 },

  // mine1
  { name: "Šachta", svgKey: "building1", locationType: "mine", effectGpop: 0, effectPow: 0, effectMaxpop: 0, effectMny: 3, effectArm: 0, cost: 30 },
  { name: "Kovárna", svgKey: "building2", locationType: "mine", effectGpop: 0, effectPow: 0, effectMaxpop: 1, effectMny: 4, effectArm: 0, cost: 50 },
  { name: "Plot", svgKey: "building3", locationType: "mine", effectGpop: 0, effectPow: 2, effectMaxpop: 0, effectMny: 0, effectArm: 5, cost: 70 },
  { name: "Strážní věž", svgKey: "building4", locationType: "mine", effectGpop: 0, effectPow: 0, effectMaxpop: 2, effectMny: 0, effectArm: 7, cost: 90 },

  // settlement8 -> town + fortress
  { name: "Pevnost", svgKey: "building1", locationType: "town", effectGpop: 0, effectPow: 2, effectMaxpop: 10, effectMny: 0, effectArm: 7, cost: 190 },
  { name: "Radnice", svgKey: "building2", locationType: "town", effectGpop: 1, effectPow: 3, effectMaxpop: 5, effectMny: 1, effectArm: 0, cost: 100 },
  { name: "Dílna", svgKey: "building3", locationType: "town", effectGpop: 0, effectPow: 3, effectMaxpop: 0, effectMny: 3, effectArm: 0, cost: 60 },
  { name: "Brána", svgKey: "building4", locationType: "town", effectGpop: 0, effectPow: 1, effectMaxpop: 0, effectMny: 0, effectArm: 6, cost: 70 },
  { name: "Severní Hradba", svgKey: "building5", locationType: "town", effectGpop: 0, effectPow: 0, effectMaxpop: 0, effectMny: 0, effectArm: 8, cost: 80 },
  { name: "Jižní Hradba", svgKey: "building6", locationType: "town", effectGpop: 0, effectPow: 0, effectMaxpop: 0, effectMny: 0, effectArm: 11, cost: 110 },
  { name: "Farma", svgKey: "building7", locationType: "town", effectGpop: 2, effectPow: 1, effectMaxpop: 10, effectMny: 0, effectArm: 0, cost: 130 },
];

let ensuredOnce = false;

export async function ensureBuildingDefinitionsSeeded() {
  if (ensuredOnce) {
    return;
  }

  const names = DEFAULT_BUILDING_DEFS.map((row) => row.name);
  const existing = await db.buildingDef.count({
    where: {
      name: {
        in: names,
      },
    },
  });

  if (existing < DEFAULT_BUILDING_DEFS.length) {
    for (const def of DEFAULT_BUILDING_DEFS) {
      await db.buildingDef.upsert({
        where: { name: def.name },
        create: def,
        update: {},
      });
    }
  }

  ensuredOnce = true;
}
