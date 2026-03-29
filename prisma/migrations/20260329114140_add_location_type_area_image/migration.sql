-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'camp',
    "area" INTEGER NOT NULL DEFAULT 1000,
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
INSERT INTO "new_Location" ("claimRadiusM", "content", "createdAt", "id", "lastClaimedAt", "latitude", "longitude", "name", "neighbors", "ownerTeamId", "qrCode", "slug", "summary", "territoryGeoJson", "updatedAt") SELECT "claimRadiusM", "content", "createdAt", "id", "lastClaimedAt", "latitude", "longitude", "name", "neighbors", "ownerTeamId", "qrCode", "slug", "summary", "territoryGeoJson", "updatedAt" FROM "Location";
DROP TABLE "Location";
ALTER TABLE "new_Location" RENAME TO "Location";
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");
CREATE UNIQUE INDEX "Location_qrCode_key" ON "Location"("qrCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
