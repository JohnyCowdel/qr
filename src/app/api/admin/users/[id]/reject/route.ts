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
    select: {
      id: true,
      isApproved: true,
      _count: {
        select: {
          claims: true,
        },
      },
    },
  });

  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  if (user.isApproved) {
    return Response.json({ error: "Approved users cannot be rejected here." }, { status: 400 });
  }

  if (user._count.claims > 0) {
    return Response.json({ error: "Users with claims cannot be rejected." }, { status: 400 });
  }

  await db.user.delete({ where: { id: userId } });

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
