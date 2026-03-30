ALTER TABLE "Location" ADD COLUMN "currentPopulation" INTEGER NOT NULL DEFAULT 1;

UPDATE "Location"
SET "currentPopulation" = MAX(1, ROUND(("area" / 1000000.0) * 10));