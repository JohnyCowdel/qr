-- CreateTable
CREATE TABLE "RevengeDiscount" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevengeDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevengeDiscount_locationId_teamId_key" ON "RevengeDiscount"("locationId", "teamId");

-- CreateIndex
CREATE INDEX "RevengeDiscount_teamId_expiresAt_idx" ON "RevengeDiscount"("teamId", "expiresAt");

-- AddForeignKey
ALTER TABLE "RevengeDiscount" ADD CONSTRAINT "RevengeDiscount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevengeDiscount" ADD CONSTRAINT "RevengeDiscount_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
