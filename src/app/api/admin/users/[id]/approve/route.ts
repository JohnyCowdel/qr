import { db } from "@/lib/db";
import { sendApprovalEmail } from "@/lib/email";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json({ error: "Invalid user id." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, isApproved: true } });
  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  if (user.isApproved) {
    return Response.json({ error: "User is already approved." }, { status: 400 });
  }

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: { isApproved: true },
    select: { email: true, handle: true },
  });

  if (updatedUser.email) {
    const result = await sendApprovalEmail(updatedUser.email, updatedUser.handle);
    if (!result.ok) {
      console.error("Email send error:", result.error);
      // Stale vratime 200, protoze schvaleni probehlo - email je pouze notifikace.
    }
  }

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
