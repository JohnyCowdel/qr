import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json(
      { ok: false, message: "Pro odmítnutí nabídky je potřeba přihlášení." },
      { status: 401 },
    );
  }

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return Response.json(
      { ok: false, message: "Neplatné ID nabídky." },
      { status: 400 },
    );
  }

  const offerId = parsedParams.data.id;

  const offer = await db.tradeOffer.findUnique({
    where: { id: offerId },
    select: { id: true, status: true, fromUserId: true, toUserId: true },
  });

  if (!offer) {
    return Response.json({ ok: false, message: "Nabídka nebyla nalezena." }, { status: 404 });
  }

  if (offer.status !== "PENDING") {
    return Response.json({ ok: false, message: "Nabídka už není aktivní." }, { status: 400 });
  }

  if (offer.fromUserId !== userId && offer.toUserId !== userId) {
    return Response.json(
      { ok: false, message: "Tuto nabídku může odmítnout jen odesílatel nebo příjemce." },
      { status: 403 },
    );
  }

  await db.tradeOffer.delete({ where: { id: offerId } });

  return Response.json({ ok: true, message: "Nabídka byla odmítnuta a smazána." });
}
