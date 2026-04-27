/**
 * Extracts embedded base64 images from SVG sprite files and replaces them
 * with external file references. This dramatically reduces the SVG file size.
 *
 * Usage: node scripts/extract-sprite-images.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, "..", "public", "sprites");

const SPRITE_FILES = ["settlement8.svg", "camp1.svg", "mine1.svg"];

for (const svgName of SPRITE_FILES) {
  const svgPath = join(SPRITES_DIR, svgName);
  if (!existsSync(svgPath)) {
    console.log(`Skipping ${svgName} (not found)`);
    continue;
  }

  let content = readFileSync(svgPath, "utf8");
  const baseName = svgName.replace(".svg", "");

  // Find all embedded images: xlink:href or href="data:image/TYPE;base64,..."
  const imageRegex = /(?:xlink:href|href)="data:image\/(png|jpeg|jpg|webp|gif);base64,([^"]+)"/g;

  let match;
  let imageIndex = 0;
  let modified = false;

  // Collect all matches first
  const replacements = [];
  while ((match = imageRegex.exec(content)) !== null) {
    const [fullMatch, ext, base64Data] = match;
    const imgFileName = imageIndex === 0
      ? `${baseName}-bg.${ext}`
      : `${baseName}-bg${imageIndex}.${ext}`;
    replacements.push({ fullMatch, ext, base64Data, imgFileName });
    imageIndex++;
  }

  for (const { fullMatch, ext, base64Data, imgFileName } of replacements) {
    const imgPath = join(SPRITES_DIR, imgFileName);

    // Decode and save the image
    const imgBuffer = Buffer.from(base64Data, "base64");
    writeFileSync(imgPath, imgBuffer);
    console.log(`  Extracted ${imgFileName} (${(imgBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    // Replace base64 in SVG with external reference
    const newRef = `href="/sprites/${imgFileName}"`;
    content = content.replace(fullMatch, newRef);
    modified = true;
  }

  if (modified) {
    writeFileSync(svgPath, content, "utf8");
    const newSize = Buffer.byteLength(content, "utf8");
    console.log(`  Updated ${svgName} → ${(newSize / 1024).toFixed(1)} KB`);
  } else {
    console.log(`  ${svgName}: no embedded images found`);
  }
}

console.log("\nDone. Commit both the updated SVGs and the new -bg.png files.");
