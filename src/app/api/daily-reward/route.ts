import { cookies } from "next/headers";
import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const userId = token ? verifyUserSessionToken(token) : null;

  if (!userId) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, power: true, lastDailyClaimAt: true },
  });

  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  const now = new Date();
  if (user.lastDailyClaimAt) {
    const msSince = now.getTime() - user.lastDailyClaimAt.getTime();
    if (msSince < 24 * 60 * 60 * 1000) {
      const msRemaining = 24 * 60 * 60 * 1000 - msSince;
      const hoursRemaining = Math.ceil(msRemaining / (60 * 60 * 1000));
      return Response.json(
        { error: `Odměnu si můžeš vyzvednout za ${hoursRemaining}h.` },
        { status: 429 },
      );
    }
  }

  const settings = await db.adminSettings.findUnique({
    where: { id: 1 },
    select: { dailyLoginReward: true },
  });
  const reward = settings?.dailyLoginReward ?? 8;

  if (user.power >= reward) {
    return Response.json(
      { error: `Odměnu dostaneš jen pokud máš méně než ${reward} síly. Teď máš ${user.power.toFixed(2)}.` },
      { status: 403 },
    );
  }

  await db.user.update({
    where: { id: userId },
    data: {
      power: { increment: reward },
      lastDailyClaimAt: now,
    },
  });

  return Response.json({ ok: true, reward });
}
