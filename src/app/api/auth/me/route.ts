import { db } from "@/lib/db";
import { readUserIdFromCookieHeader } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json({ authenticated: false });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      team: true,
    },
  });

  if (!user) {
    return Response.json({ authenticated: false });
  }

  return Response.json({
    authenticated: true,
    user: {
      id: user.id,
      handle: user.handle,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      age: user.age,
      power: user.power,
      team: {
        id: user.team.id,
        name: user.team.name,
        slug: user.team.slug,
        colorHex: user.team.colorHex,
        power: user.team.power,
      },
    },
  });
}
