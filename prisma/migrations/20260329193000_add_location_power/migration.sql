-- Add base power per location type.
ALTER TABLE "Location" ADD COLUMN "power" INTEGER NOT NULL DEFAULT 8;

UPDATE "Location"
SET "power" = CASE "type"
  WHEN 'fortress' THEN 25
  WHEN 'tower' THEN 15
  WHEN 'town' THEN 10
  WHEN 'camp' THEN 8
  WHEN 'mine' THEN 8
  ELSE 8
END;
