import { z } from "zod";

import { db } from "@/lib/db";

const updateUserSchema = z.object({
  handle: z.string().trim().min(2).max(32),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  age: z.coerce.number().int().min(6).max(120),
  power: z.coerce.number().min(0).max(100000),
  money: z.coerce.number().min(0).max(1000000),
  teamId: z.coerce.number().int().positive(),
  isApproved: z.boolean(),
});

async function updateUser(userId: number, payload: unknown) {
  const parsed = updateUserSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false as const, status: 400, body: { error: "Invalid payload", issues: parsed.error.flatten() } };
  }

  const existingUser = await db.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    return { ok: false as const, status: 404, body: { error: "User not found." } };
  }

  const { handle, firstName, lastName, email, age, power, money, teamId, isApproved } = parsed.data;

  const [otherHandleUser, otherEmailUser, team] = await Promise.all([
    db.user.findFirst({ where: { handle, id: { not: userId } }, select: { id: true } }),
    db.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } }),
    db.team.findUnique({ where: { id: teamId }, select: { id: true } }),
  ]);

  if (otherHandleUser) {
    return { ok: false as const, status: 409, body: { error: "Handle already in use." } };
  }

  if (otherEmailUser) {
    return { ok: false as const, status: 409, body: { error: "Email already in use." } };
  }

  if (!team) {
    return { ok: false as const, status: 400, body: { error: "Team not found." } };
  }

  const user = await db.user.update({
    where: { id: userId },
    data: {
      handle,
      firstName,
      lastName,
      email,
      age,
      power,
      money,
      teamId,
      isApproved,
    },
  });

  return { ok: true as const, status: 200, body: user };
}

export async function GET(
  _request: Request,
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
      team: true,
    },
  });

  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  return Response.json(user);
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json({ error: "Invalid user id." }, { status: 400 });
  }

  const result = await updateUser(userId, await request.json().catch(() => null));
  if (!result.ok) {
    return Response.json(result.body, { status: result.status });
  }

  return Response.json(result.body);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return Response.json({ error: "Invalid user id." }, { status: 400 });
  }

  const formData = await request.formData();
  const payload = {
    handle: formData.get("handle"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    age: formData.get("age"),
    power: formData.get("power"),
    money: formData.get("money"),
    teamId: formData.get("teamId"),
    isApproved: formData.get("isApproved") === "on",
  };

  const result = await updateUser(userId, payload);
  if (!result.ok) {
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/admin/players",
    },
  });
}
