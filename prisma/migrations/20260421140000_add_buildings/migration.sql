-- CreateTable
CREATE TABLE "BuildingDef" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "svgKey" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "effectGpop" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectPow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectMaxpop" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectMny" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectArm" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BuildingDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuiltBuilding" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "buildingDefId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuiltBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuildingDef_name_key" ON "BuildingDef"("name");

-- CreateIndex
CREATE UNIQUE INDEX "BuiltBuilding_locationId_buildingDefId_key" ON "BuiltBuilding"("locationId", "buildingDefId");

-- AddForeignKey
ALTER TABLE "BuiltBuilding" ADD CONSTRAINT "BuiltBuilding_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuiltBuilding" ADD CONSTRAINT "BuiltBuilding_buildingDefId_fkey" FOREIGN KEY ("buildingDefId") REFERENCES "BuildingDef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
