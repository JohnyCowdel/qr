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
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid registration payload." }, { status: 400 });
  }

  const { handle, password, teamId, firstName, lastName, email, age } = parsed.data;

  const team = await db.team.findUnique({ where: { id: teamId } });
  if (!team) {
    return Response.json({ error: "Selected team was not found." }, { status: 400 });
  }

  const [existingByHandle, existingByEmail] = await Promise.all([
    db.user.findUnique({ where: { handle } }),
    db.user.findUnique({ where: { email } }),
  ]);

  if (existingByHandle) {
    return Response.json({ error: "Handle already registered." }, { status: 409 });
  }

  if (existingByEmail) {
    return Response.json({ error: "Email already registered." }, { status: 409 });
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
