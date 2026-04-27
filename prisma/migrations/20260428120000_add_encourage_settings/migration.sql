-- Add configurable encourage action settings to admin settings.
ALTER TABLE "AdminSettings"
ADD COLUMN "encourageCost" REAL NOT NULL DEFAULT 10,
ADD COLUMN "encourageArmorBonus" REAL NOT NULL DEFAULT 5;
