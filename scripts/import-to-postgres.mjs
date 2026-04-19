/**
 * Import data from scripts/sqlite-export.json into the DATABASE_URL database (PostgreSQL).
 * Run with your production DATABASE_URL set:
 *   $env:DATABASE_URL="postgres://..."; node scripts/import-to-postgres.mjs
 *
 * Safe to run multiple times – uses upsert so existing rows are updated, not duplicated.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(resolve(__dirname, "sqlite-export.json"), "utf8"));

const prisma = new PrismaClient();

async function main() {
  // 1 – Teams
  console.log(`Importing ${data.Team.length} teams…`);
  for (const row of data.Team) {
    await prisma.team.upsert({
      where: { id: row.id },
      update: { slug: row.slug, name: row.name, colorHex: row.colorHex, power: row.power },
      create: { id: row.id, slug: row.slug, name: row.name, colorHex: row.colorHex, power: row.power ?? 10, createdAt: new Date(row.createdAt) },
    });
  }

  // 2 – Users
  console.log(`Importing ${data.User.length} users…`);
  for (const row of data.User) {
    await prisma.user.upsert({
      where: { id: row.id },
      update: {
        handle: row.handle, firstName: row.firstName, lastName: row.lastName,
        email: row.email, age: row.age, isApproved: row.isApproved === 1 || row.isApproved === true,
        avatarType: row.avatarType, avatarSprite: row.avatarSprite, avatarSeed: row.avatarSeed,
        avatarPhotoDataUrl: row.avatarPhotoDataUrl, passwordHash: row.passwordHash,
        power: row.power, money: row.money, population: row.population, teamId: row.teamId,
      },
      create: {
        id: row.id, handle: row.handle, firstName: row.firstName, lastName: row.lastName,
        email: row.email, age: row.age, isApproved: row.isApproved === 1 || row.isApproved === true,
        avatarType: row.avatarType ?? "sprite", avatarSprite: row.avatarSprite ?? "adventurer",
        avatarSeed: row.avatarSeed, avatarPhotoDataUrl: row.avatarPhotoDataUrl,
        passwordHash: row.passwordHash, power: row.power ?? 5, money: row.money ?? 10,
        population: row.population ?? 0, teamId: row.teamId,
        createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt),
      },
    });
  }

  // 3 – Locations
  console.log(`Importing ${data.Location.length} locations…`);
  for (const row of data.Location) {
    await prisma.location.upsert({
      where: { id: row.id },
      update: {
        slug: row.slug, name: row.name, type: row.type, armor: row.armor, area: row.area,
        currentPopulation: row.currentPopulation, popToMoney: row.popToMoney,
        popToPower: row.popToPower, popToPopulation: row.popToPopulation,
        image: row.image, summary: row.summary, content: row.content,
        latitude: row.latitude, longitude: row.longitude, claimRadiusM: row.claimRadiusM,
        neighbors: row.neighbors, territoryGeoJson: row.territoryGeoJson,
        ownerTeamId: row.ownerTeamId, lastClaimedAt: row.lastClaimedAt ? new Date(row.lastClaimedAt) : null,
        economyUpdatedAt: new Date(row.economyUpdatedAt ?? row.createdAt),
      },
      create: {
        id: row.id, slug: row.slug, qrCode: row.qrCode, name: row.name,
        type: row.type ?? "camp", armor: row.armor ?? 8, area: row.area ?? 1000,
        currentPopulation: row.currentPopulation ?? 1,
        popToMoney: row.popToMoney ?? 0, popToPower: row.popToPower ?? 0,
        popToPopulation: row.popToPopulation ?? 30,
        economyUpdatedAt: new Date(row.economyUpdatedAt ?? row.createdAt),
        image: row.image ?? "⛺", summary: row.summary, content: row.content,
        latitude: row.latitude, longitude: row.longitude, claimRadiusM: row.claimRadiusM ?? 50,
        neighbors: row.neighbors, territoryGeoJson: row.territoryGeoJson,
        ownerTeamId: row.ownerTeamId ?? null,
        lastClaimedAt: row.lastClaimedAt ? new Date(row.lastClaimedAt) : null,
        createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt),
      },
    });
  }

  // 4 – Claims
  console.log(`Importing ${data.Claim.length} claims…`);
  for (const row of data.Claim) {
    await prisma.claim.upsert({
      where: { id: row.id },
      update: {
        message: row.message, latitude: row.latitude, longitude: row.longitude,
        accuracyM: row.accuracyM, distanceM: row.distanceM,
        locationId: row.locationId, teamId: row.teamId, userId: row.userId,
      },
      create: {
        id: row.id, message: row.message, latitude: row.latitude, longitude: row.longitude,
        accuracyM: row.accuracyM, distanceM: row.distanceM,
        createdAt: new Date(row.createdAt),
        locationId: row.locationId, teamId: row.teamId, userId: row.userId,
      },
    });
  }

  // 5 – AdminSettings
  if (data.AdminSettings.length > 0) {
    const s = data.AdminSettings[0];
    console.log("Importing AdminSettings…");
    await prisma.adminSettings.upsert({
      where: { id: 1 },
      update: {
        passwordHash: s.passwordHash,
        moneyRate: s.moneyRate, powerRate: s.powerRate, populationRate: s.populationRate,
      },
      create: {
        id: 1, passwordHash: s.passwordHash,
        moneyRate: s.moneyRate ?? 0.5, powerRate: s.powerRate ?? 0.5, populationRate: s.populationRate ?? 1,
      },
    });
  }

  console.log("\nDone! All local data imported to production database.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
