import { z } from "zod";

import { db } from "@/lib/db";
import {
  USER_COOKIE_NAME,
  SESSION_MAX_AGE,
  createUserSessionToken,
  verifyPassword,
} from "@/lib/auth";

const loginSchema = z.object({
  handle: z.string().trim().min(2).max(32),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid login payload." }, { status: 400 });
  }

  const { handle, password } = parsed.data;

  const user = await db.user.findUnique({
    where: { handle },
    select: { id: true, passwordHash: true, isApproved: true },
  });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return Response.json({ error: "Invalid handle or password." }, { status: 401 });
  }

  if (!user.isApproved) {
    return Response.json({ error: "Your account is waiting for admin approval." }, { status: 403 });
  }

  const token = createUserSessionToken(user.id);
  const cookie = `${USER_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
