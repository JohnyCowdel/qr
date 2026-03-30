PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'camp',
    "armor" INTEGER NOT NULL DEFAULT 8,
    "area" INTEGER NOT NULL DEFAULT 1000,
    "currentPopulation" REAL NOT NULL DEFAULT 1,
    "popToMoney" INTEGER NOT NULL DEFAULT 0,
    "popToPower" INTEGER NOT NULL DEFAULT 0,
    "popToPopulation" INTEGER NOT NULL DEFAULT 30,
    "economyUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "image" TEXT NOT NULL DEFAULT '⛺',
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "claimRadiusM" INTEGER NOT NULL DEFAULT 50,
    "neighbors" TEXT,
    "territoryGeoJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerTeamId" INTEGER,
    "lastClaimedAt" DATETIME,
    CONSTRAINT "Location_ownerTeamId_fkey" FOREIGN KEY ("ownerTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Location" (
  "id", "slug", "qrCode", "name", "type", "armor", "area", "currentPopulation", "popToMoney", "popToPower", "popToPopulation", "economyUpdatedAt", "image", "summary", "content", "latitude", "longitude", "claimRadiusM", "neighbors", "territoryGeoJson", "createdAt", "updatedAt", "ownerTeamId", "lastClaimedAt"
)
SELECT
  "id", "slug", "qrCode", "name", "type", "armor", "area", CAST("currentPopulation" AS REAL), "popToMoney", "popToPower", "popToPopulation", "economyUpdatedAt", "image", "summary", "content", "latitude", "longitude", "claimRadiusM", "neighbors", "territoryGeoJson", "createdAt", "updatedAt", "ownerTeamId", "lastClaimedAt"
FROM "Location";

DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");
CREATE UNIQUE INDEX "Location_qrCode_key" ON "Location"("qrCode");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
