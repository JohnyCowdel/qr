PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "handle" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "age" INTEGER,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "avatarType" TEXT NOT NULL DEFAULT 'sprite',
    "avatarSprite" TEXT NOT NULL DEFAULT 'adventurer',
    "avatarSeed" TEXT,
    "avatarPhotoDataUrl" TEXT,
    "passwordHash" TEXT,
    "power" REAL NOT NULL DEFAULT 5,
    "money" REAL NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" INTEGER NOT NULL,
    CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_User" (
  "id", "handle", "firstName", "lastName", "email", "age", "isApproved", "avatarType", "avatarSprite", "avatarSeed", "avatarPhotoDataUrl", "passwordHash", "power", "money", "createdAt", "updatedAt", "teamId"
)
SELECT
  "id", "handle", "firstName", "lastName", "email", "age", "isApproved", "avatarType", "avatarSprite", "avatarSeed", "avatarPhotoDataUrl", "passwordHash", CAST("power" AS REAL), 10, "createdAt", "updatedAt", "teamId"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;