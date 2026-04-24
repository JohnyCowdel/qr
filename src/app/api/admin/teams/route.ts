import { z } from "zod";

import { db } from "@/lib/db";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function uniqueSlug(base: string) {
  let slug = base;
  let attempt = 0;
  while (await db.team.findUnique({ where: { slug } })) {
    attempt++;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emoji: z.string().trim().min(1).max(8).default("🏴"),
  isHidden: z.boolean().default(false),
});

export async function GET() {
  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      colorHex: true,
      emoji: true,
      isHidden: true,
      power: true,
      _count: { select: { users: true } },
    },
  });
  return Response.json(teams);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const slug = await uniqueSlug(slugify(parsed.data.name));
  const team = await db.team.create({
    data: { ...parsed.data, slug },
    select: { id: true, slug: true, name: true, colorHex: true, emoji: true, isHidden: true, power: true },
  });
  return Response.json(team, { status: 201 });
}
