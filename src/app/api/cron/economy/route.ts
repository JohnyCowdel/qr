import { runEconomyTick } from "@/lib/economy";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = new Date();
  await runEconomyTick(startedAt);

  return Response.json({ ok: true, ranAt: startedAt.toISOString() });
}