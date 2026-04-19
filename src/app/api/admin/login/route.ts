import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/auth";

async function getOrInitSettings() {
  // First boot: persist default admin/admin credentials; concurrent calls stay safe.
  return db.adminSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, passwordHash: hashPassword("admin") },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { password } = body as { password?: unknown };
  if (typeof password !== "string" || !password) {
    return Response.json({ error: "Password required." }, { status: 400 });
  }

  const settings = await getOrInitSettings();

  if (!verifyPassword(password, settings.passwordHash)) {
    return Response.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const token = createSessionToken();
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
