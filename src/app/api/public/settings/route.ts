import { db } from "@/lib/db";

export async function GET() {
  const settings = await db.adminSettings.findUnique({
    where: { id: 1 },
    select: { registrationsOpen: true },
  });

  return Response.json({
    registrationsOpen: settings?.registrationsOpen ?? true,
  });
}
