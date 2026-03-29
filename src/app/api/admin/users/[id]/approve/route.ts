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

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  await db.user.update({
    where: { id: userId },
    data: { isApproved: true },
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
