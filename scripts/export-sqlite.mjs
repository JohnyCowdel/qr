/**
 * Export all data from local SQLite dev.db to scripts/sqlite-export.json
 * Usage: node scripts/export-sqlite.mjs
 */
import Database from "better-sqlite3";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, "../prisma/dev.db");
const outPath = resolve(__dirname, "sqlite-export.json");

const db = new Database(dbPath, { readonly: true });

const tables = ["Team", "User", "Location", "Claim", "AdminSettings"];
const data = {};

for (const table of tables) {
  try {
    data[table] = db.prepare(`SELECT * FROM "${table}"`).all();
    console.log(`  ${table}: ${data[table].length} rows`);
  } catch (e) {
    console.warn(`  ${table}: skipped (${e.message})`);
    data[table] = [];
  }
}

db.close();
writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`\nExported to ${outPath}`);
