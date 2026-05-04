import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAYER_MONEY_CAP, PLAYER_POWER_CAP } from "@/lib/economy";

const createOfferSchema = z.object({
  toUserId: z.number().int().positive(),
  offerType: z.enum(["MONEY", "POWER"]),
  offerAmount: z.number().positive(),
  requestType: z.enum(["MONEY", "POWER"]),
  requestAmount: z.number().min(0),
});

function getResourceValue(user: { money: number; power: number }, resourceType: "MONEY" | "POWER") {
  return resourceType === "MONEY" ? user.money : user.power;
}

function getResourceCap(resourceType: "MONEY" | "POWER") {
  return resourceType === "MONEY" ? PLAYER_MONEY_CAP : PLAYER_POWER_CAP;
}

export async function POST(request: Request) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json(
      { ok: false, message: "Pro vytvoření nabídky je potřeba přihlášení." },
      { status: 401 },
    );
  }

  const parsed = createOfferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { ok: false, message: "Neplatná data nabídky." },
      { status: 400 },
    );
  }

  const { toUserId, offerType, offerAmount, requestType, requestAmount } = parsed.data;

  if (toUserId === userId) {
    return Response.json(
      { ok: false, message: "Nabídku nelze poslat sám sobě." },
      { status: 400 },
    );
  }

  const [fromUser, toUser] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, money: true, power: true } }),
    db.user.findUnique({ where: { id: toUserId }, select: { id: true, money: true, power: true } }),
  ]);

  if (!fromUser || !toUser) {
    return Response.json(
      { ok: false, message: "Hráč nebyl nalezen." },
      { status: 404 },
    );
  }

  const offerBalance = offerType === "MONEY" ? fromUser.money : fromUser.power;
  if (offerBalance < offerAmount) {
    return Response.json(
      { ok: false, message: "Na nabídku nemáš dostatek zdrojů." },
      { status: 400 },
    );
  }

  const toReceiveCap = getResourceCap(offerType);
  const toReceiveCurrent = getResourceValue(toUser, offerType);
  if (toReceiveCurrent + offerAmount > toReceiveCap) {
    return Response.json(
      {
        ok: false,
        message: `Nabídku nelze vytvořit: cílový hráč by překročil limit (${toReceiveCap}) pro ${offerType === "MONEY" ? "peníze" : "sílu"}.`,
      },
      { status: 400 },
    );
  }

  if (requestAmount > 0) {
    const fromReceiveCap = getResourceCap(requestType);
    const fromReceiveCurrent = getResourceValue(fromUser, requestType);
    if (fromReceiveCurrent + requestAmount > fromReceiveCap) {
      return Response.json(
        {
          ok: false,
          message: `Nabídku nelze vytvořit: po přijetí bys překročil limit (${fromReceiveCap}) pro ${requestType === "MONEY" ? "peníze" : "sílu"}.`,
        },
        { status: 400 },
      );
    }
  }

  await db.tradeOffer.create({
    data: {
      fromUserId: fromUser.id,
      toUserId: toUser.id,
      offerType,
      offerAmount,
      requestType,
      requestAmount,
    },
  });

  return Response.json({ ok: true, message: "Nabídka byla odeslána." });
}
