CREATE TABLE "LocationGreeting" (
    "id" SERIAL NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "LocationGreeting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LocationGreeting_locationId_createdAt_idx" ON "LocationGreeting"("locationId", "createdAt");
CREATE INDEX "LocationGreeting_userId_createdAt_idx" ON "LocationGreeting"("userId", "createdAt");

ALTER TABLE "LocationGreeting" ADD CONSTRAINT "LocationGreeting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LocationGreeting" ADD CONSTRAINT "LocationGreeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
