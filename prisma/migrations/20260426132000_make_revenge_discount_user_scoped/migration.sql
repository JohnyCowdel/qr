-- Revenge discount is now user-scoped (robbed player), not team-scoped.
-- Existing rows are dropped because historical team-based records cannot be mapped
-- deterministically to a single user.
DELETE FROM "RevengeDiscount";

ALTER TABLE "RevengeDiscount" DROP CONSTRAINT "RevengeDiscount_teamId_fkey";

DROP INDEX "RevengeDiscount_locationId_teamId_key";
DROP INDEX "RevengeDiscount_teamId_expiresAt_idx";

ALTER TABLE "RevengeDiscount" DROP COLUMN "teamId";
ALTER TABLE "RevengeDiscount" ADD COLUMN "userId" INTEGER NOT NULL;

CREATE UNIQUE INDEX "RevengeDiscount_locationId_userId_key" ON "RevengeDiscount"("locationId", "userId");
CREATE INDEX "RevengeDiscount_userId_expiresAt_idx" ON "RevengeDiscount"("userId", "expiresAt");

ALTER TABLE "RevengeDiscount" ADD CONSTRAINT "RevengeDiscount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
