import { db } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json({ error: "Invalid user id." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      claims: {
        select: {
          locationId: true,
        },
      },
    },
  });

  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  const affectedLocationIds = [...new Set(user.claims.map((claim) => claim.locationId))];

  await db.$transaction(async (tx) => {
    await tx.claim.deleteMany({
      where: { userId },
    });

    await tx.user.delete({
      where: { id: userId },
    });

    for (const locationId of affectedLocationIds) {
      const latestClaim = await tx.claim.findFirst({
        where: { locationId },
        orderBy: { createdAt: "desc" },
        select: {
          teamId: true,
          createdAt: true,
        },
      });

      await tx.location.update({
        where: { id: locationId },
        data: {
          ownerTeamId: latestClaim?.teamId ?? null,
          lastClaimedAt: latestClaim?.createdAt ?? null,
        },
      });
    }
  });

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin/players",
      },
    });
  }

  return Response.json({ ok: true });
}
