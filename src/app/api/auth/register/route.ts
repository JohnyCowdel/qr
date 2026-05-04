import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const registerSchema = z.object({
  handle: z.string().trim().min(2).max(32),
  password: z.string().min(6).max(128),
  teamId: z.coerce.number().int().positive(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  age: z.coerce.number().int().min(6).max(120),
});

export async function POST(request: Request) {
  const settings = await db.adminSettings.findUnique({
    where: { id: 1 },
    select: { registrationsOpen: true },
  });
  if (settings?.registrationsOpen === false) {
    return Response.json({ error: "Registrations are currently closed." }, { status: 403 });
  }

  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid registration payload." }, { status: 400 });
  }

  const { handle, password, teamId, firstName, lastName, email, age } = parsed.data;

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team || team.isHidden) {
    return Response.json({ error: "Selected team was not found." }, { status: 400 });
  }

  const existingByHandle = await db.user.findUnique({ where: { handle } });

  if (existingByHandle) {
    return Response.json({ error: "Handle already registered." }, { status: 409 });
  }

  const passwordHash = hashPassword(password);

  await db.user.create({
    data: {
      handle,
      firstName,
      lastName,
      email,
      age,
      passwordHash,
      teamId,
      isApproved: false,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
