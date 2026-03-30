ALTER TABLE "User" ADD COLUMN "avatarType" TEXT NOT NULL DEFAULT 'sprite';
ALTER TABLE "User" ADD COLUMN "avatarSprite" TEXT NOT NULL DEFAULT 'ember-fox';
ALTER TABLE "User" ADD COLUMN "avatarPhotoDataUrl" TEXT;
