import { z } from "zod";

import { db } from "@/lib/db";
import { calculateMinPopulation } from "@/lib/location-population";
import { baseArmorForType, defaultImageForType, LOCATION_TYPES } from "@/lib/location-types";

const createSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(LOCATION_TYPES).default("camp"),
  ownerTeamId: z.coerce.number().int().positive().nullable().optional(),
  area: z.coerce.number().int().positive().default(1000),
  currentPopulation: z.coerce.number().min(0).optional(),
  image: z.string().trim().min(1).max(32).optional(),
  summary: z.string().trim().min(1),
  content: z.string().trim().min(1),
  latitude: z.coerce.number().finite(),
  longitude: z.coerce.number().finite(),
  claimRadiusM: z.coerce.number().int().positive(),
});

function slugifyName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "location";
}

async function generateIdentifiers(name: string) {
  const baseSlug = slugifyName(name);
  let slug = baseSlug;
  let suffix = 2;

  for (;;) {
    const existing = await db.location.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) {
      return {
        slug,
        qrCode: `QR-${slug.toUpperCase()}`,
      };
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function GET() {
  const locations = await db.location.findMany({
    select: {
      slug: true, name: true, type: true, armor: true, area: true,
      image: true, summary: true, content: true,
      latitude: true, longitude: true, claimRadiusM: true,
      ownerTeam: { select: { id: true, name: true, colorHex: true, emoji: true } },
    },
    orderBy: { name: "asc" },
  });
  return Response.json(locations);
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const identifiers = await generateIdentifiers(parsed.data.name);
  const area = parsed.data.area;
  const location = await db.location.create({
    data: {
      ...parsed.data,
      area,
      armor: baseArmorForType(parsed.data.type),
      currentPopulation: parsed.data.currentPopulation ?? calculateMinPopulation(area),
      image: parsed.data.image?.trim() || defaultImageForType(parsed.data.type),
      ownerTeamId: parsed.data.ownerTeamId ?? null,
      ...identifiers,
    },
  });
  return Response.json(location, { status: 201 });
}
