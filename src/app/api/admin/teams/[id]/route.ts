import { z } from "zod";

import { db } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  isHidden: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const team = await db.team.update({
      where: { id: Number(id) },
      data: parsed.data,
      select: { id: true, slug: true, name: true, colorHex: true, emoji: true, isHidden: true, power: true },
    });
    return Response.json(team);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const team = await db.team.findUnique({
    where: { id: Number(id) },
    select: { id: true, _count: { select: { users: true } } },
  });
  if (!team) return Response.json({ error: "Not found" }, { status: 404 });
  if (team._count.users > 0) {
    return Response.json({ error: "Nelze smazat tým s hráči." }, { status: 409 });
  }

  await db.team.delete({ where: { id: Number(id) } });
  return new Response(null, { status: 204 });
}
