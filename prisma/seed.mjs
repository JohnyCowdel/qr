import { randomBytes, scryptSync } from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import { readFile } from "fs/promises";
import { PrismaClient } from "@prisma/client";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const teams = [
  { slug: "crimson-foxes", name: "🦊 Rudé lišky", colorHex: "#c84c3c", power: 32 },
  { slug: "pine-riders", name: "🐺 Modří vlci", colorHex: "#2f7d5d", power: 28 },
  { slug: "golden-rooks", name: "🦅 Zlatí jestřábi", colorHex: "#c18b2f", power: 30 },
];

const locations = [
  {
    slug: "horka-na-sazavou",
    qrCode: "QR-HORKA",
    name: "Horka na Sazavou",
    type: "fortress",
    armor: 25,
    area: 3400,
    image: "🏰",
    summary: "Hilltop lookout with a clean GPS lock and wide map visibility.",
    content:
      "A ridge position above the river. This point controls a visible approach line, so it is a natural rally target for nearby teams.",
    latitude: 49.7322,
    longitude: 15.7614,
    claimRadiusM: 550,
    neighbors: "borovsky-bend,zamek-gate",
  },
  {
    slug: "borovsky-bend",
    qrCode: "QR-BOROVSKY",
    name: "Borovsky Bend",
    type: "mine",
    armor: 8,
    area: 2200,
    image: "⛏️",
    summary: "River bend checkpoint with dense cover and quick reclaim paths.",
    content:
      "A lower terrain point near the river edge. Great for ambush routes and quick turnover if teams keep moving.",
    latitude: 49.7357,
    longitude: 15.7703,
    claimRadiusM: 450,
    neighbors: "horka-na-sazavou,zamek-gate",
  },
  {
    slug: "zamek-gate",
    qrCode: "QR-ZAMEK",
    name: "Zamek Gate",
    type: "town",
    armor: 10,
    area: 2800,
    image: "🏘️",
    summary: "Historic gate zone that links two flanks of the play area.",
    content:
      "A gateway control point with enough open space for GPS to behave reliably. Useful as a central handoff point for team movement.",
    latitude: 49.7291,
    longitude: 15.7739,
    claimRadiusM: 500,
    neighbors: "horka-na-sazavou,borovsky-bend",
  },
];

async function main() {
  await prisma.claim.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.team.deleteMany();

  const createdTeams = {};

  for (const team of teams) {
    createdTeams[team.slug] = await prisma.team.create({ data: team });
  }

  const createdLocations = {};

  for (const [index, location] of locations.entries()) {
    const ownerTeam = index === 0 ? createdTeams["crimson-foxes"] : null;
    const currentPopulation = Math.max(1, Math.round((location.area / 1_000_000) * 10));

    createdLocations[location.slug] = await prisma.location.create({
      data: {
        ...location,
        currentPopulation,
        ownerTeamId: ownerTeam?.id,
        lastClaimedAt: ownerTeam ? new Date("2026-04-03T12:32:00.000Z") : null,
      },
    });
  }

  const scout = await prisma.user.create({
    data: {
      handle: "User1234",
      firstName: "Jan",
      lastName: "Novak",
      email: "user1234@example.com",
      age: 24,
      isApproved: true,
      avatarType: "sprite",
      avatarSprite: "adventurer",
      power: 12.35,
      money: 10,
      teamId: createdTeams["crimson-foxes"].id,
    },
  });

  const ranger = await prisma.user.create({
    data: {
      handle: "ScoutMara",
      firstName: "Mara",
      lastName: "Svobodova",
      email: "scoutmara@example.com",
      age: 22,
      isApproved: true,
      avatarType: "sprite",
      avatarSprite: "adventurer",
      power: 11.5,
      money: 10,
      teamId: createdTeams["pine-riders"].id,
    },
  });

  await prisma.claim.create({
    data: {
      locationId: createdLocations["horka-na-sazavou"].id,
      teamId: createdTeams["crimson-foxes"].id,
      userId: scout.id,
      message: "Now its mine, suckers!",
      latitude: 49.73218,
      longitude: 15.76148,
      accuracyM: 12,
      distanceM: 8.4,
      createdAt: new Date("2026-04-03T12:32:00.000Z"),
    },
  });

  await prisma.claim.create({
    data: {
      locationId: createdLocations["borovsky-bend"].id,
      teamId: createdTeams["pine-riders"].id,
      userId: ranger.id,
      message: "Holding this crossing until backup arrives.",
      latitude: 49.73565,
      longitude: 15.77025,
      accuracyM: 10,
      distanceM: 5.1,
      createdAt: new Date("2026-04-02T18:12:00.000Z"),
    },
  });

  // Initialise default admin credentials (preserves existing password if already set)
  await prisma.adminSettings.upsert({
    where: { id: 1 },
    create: { id: 1, passwordHash: hashPassword("admin") },
    update: {},
  });

  // Seed building definitions from sprite metadata.
  // Cost default = 10 × sum of all effect values (can be overridden by admin later).
  const metadataFiles = [
    { file: "camp1.metadata.json", locationType: "camp" },
    { file: "mine1.metadata.json", locationType: "mine" },
    { file: "settlement8.metadata.json", locationType: "town" },
  ];

  const buildingDefs = [];
  for (const source of metadataFiles) {
    const fullPath = path.join(__dirname, "..", "sprites", source.file);
    const parsed = JSON.parse(await readFile(fullPath, "utf8"));
    const buildingMap = parsed.buildingMap ?? {};

    for (const [svgKey, building] of Object.entries(buildingMap)) {
      const stats = building.stats ?? {};
      const effectGpop = Number(stats.gpop ?? 0);
      const effectPow = Number(stats.pow ?? 0);
      const effectMaxpop = Number(stats.maxpop ?? 0);
      const effectMny = Number(stats.mny ?? 0);
      const effectArm = Number(stats.arm ?? 0);

      buildingDefs.push({
        name: String(building.name),
        svgKey: String(svgKey),
        locationType: source.locationType,
        effectGpop,
        effectPow,
        effectMaxpop,
        effectMny,
        effectArm,
        cost: 10 * (effectGpop + effectPow + effectMaxpop + effectMny + effectArm),
      });
    }
  }

  for (const def of buildingDefs) {
    await prisma.buildingDef.upsert({
      where: { name: def.name },
      create: def,
      update: { svgKey: def.svgKey, locationType: def.locationType },
      // Note: cost and effects are NOT overwritten on update so admin changes are preserved.
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });