import { PrismaClient } from "@prisma/client";
import { scryptSync, timingSafeEqual } from "crypto";

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const computed = scryptSync(password, salt, 64);
  const hashBuf = Buffer.from(hash, "hex");
  return computed.length === hashBuf.length && timingSafeEqual(computed, hashBuf);
}

const prisma = new PrismaClient();

try {
  const row = await prisma.adminSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    console.log("NO_ROW");
  } else {
    console.log(JSON.stringify({
      hasRow: true,
      adminMatches: verifyPassword("admin", row.passwordHash),
      moneyRate: row.moneyRate,
      powerRate: row.powerRate,
      populationRate: row.populationRate,
    }, null, 2));
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
