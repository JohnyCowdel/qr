import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(4),
});

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "currentPassword and newPassword (min 4 chars) required." }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  const settings = await db.adminSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    return Response.json({ error: "Admin settings not initialised." }, { status: 500 });
  }

  if (!verifyPassword(currentPassword, settings.passwordHash)) {
    return Response.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  await db.adminSettings.update({
    where: { id: 1 },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return Response.json({ ok: true });
}
