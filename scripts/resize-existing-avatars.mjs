/**
 * One-time migration: resize all photo avatars already stored in the DB
 * to max 256×256 JPEG, then update the record.
 *
 * Usage (from project root):
 *   node scripts/resize-existing-avatars.mjs
 *
 * Requires DATABASE_URL env var (reads from .env automatically).
 */

import { createRequire } from "module";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = join(__dirname, "..", ".env");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env not found – rely on environment
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const sharp = require("sharp");

const db = new PrismaClient();
const MAX_SIZE = 256;
const JPEG_QUALITY = 88;

async function main() {
  const users = await db.user.findMany({
    where: { avatarType: "photo", avatarPhotoDataUrl: { not: null } },
    select: { id: true, handle: true, avatarPhotoDataUrl: true },
  });

  console.log(`Found ${users.length} users with photo avatars.`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const dataUrl = user.avatarPhotoDataUrl;
      const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,([^,\n]+)/);
      if (!match) {
        console.log(`  [${user.id}] ${user.handle}: invalid data URL, skipping`);
        skipped++;
        continue;
      }

      const [, , base64Data] = match;
      const originalBuffer = Buffer.from(base64Data, "base64");
      const originalKB = Math.round(originalBuffer.length / 1024);

      // Get image dimensions
      const meta = await sharp(originalBuffer).metadata();
      const maxDim = Math.max(meta.width ?? 0, meta.height ?? 0);

      if (maxDim <= MAX_SIZE && originalBuffer.length <= 200 * 1024) {
        console.log(`  [${user.id}] ${user.handle}: already small (${originalKB} KB, ${meta.width}×${meta.height}), skipping`);
        skipped++;
        continue;
      }

      // Resize and convert to JPEG
      const resizedBuffer = await sharp(originalBuffer)
        .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      const newKB = Math.round(resizedBuffer.length / 1024);
      const newDataUrl = `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;

      await db.user.update({
        where: { id: user.id },
        data: { avatarPhotoDataUrl: newDataUrl },
      });

      console.log(`  [${user.id}] ${user.handle}: ${originalKB} KB → ${newKB} KB (${meta.width}×${meta.height} → ≤${MAX_SIZE}×${MAX_SIZE})`);
      updated++;
    } catch (err) {
      console.error(`  [${user.id}] ${user.handle}: ERROR – ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
