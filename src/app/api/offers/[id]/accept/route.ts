import { z } from "zod";

import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLAYER_MONEY_CAP, PLAYER_POWER_CAP } from "@/lib/economy";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

function getResourceValue(user: { money: number; power: number }, resourceType: "MONEY" | "POWER") {
  return resourceType === "MONEY" ? user.money : user.power;
}

function getResourceCap(resourceType: "MONEY" | "POWER") {
  return resourceType === "MONEY" ? PLAYER_MONEY_CAP : PLAYER_POWER_CAP;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json(
      { ok: false, message: "Pro přijetí nabídky je potřeba přihlášení." },
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

  const result = await db.$transaction(async (tx) => {
    const offer = await tx.tradeOffer.findUnique({ where: { id: offerId } });

    if (!offer) {
      return { ok: false, status: 404 as const, message: "Nabídka nebyla nalezena." };
    }

    if (offer.status !== "PENDING") {
      return { ok: false, status: 400 as const, message: "Nabídka už není aktivní." };
    }

    if (offer.toUserId !== userId) {
      return { ok: false, status: 403 as const, message: "Tuto nabídku může přijmout jen cílový hráč." };
    }

    const [fromUser, toUser] = await Promise.all([
      tx.user.findUnique({ where: { id: offer.fromUserId }, select: { id: true, money: true, power: true } }),
      tx.user.findUnique({ where: { id: offer.toUserId }, select: { id: true, money: true, power: true } }),
    ]);

    if (!fromUser || !toUser) {
      return { ok: false, status: 404 as const, message: "Hráč nebyl nalezen." };
    }

    const fromBalance = getResourceValue(fromUser, offer.offerType);
    if (fromBalance < offer.offerAmount) {
      return {
        ok: false,
        status: 400 as const,
        message: "Nabízející hráč už nemá dostatek zdrojů pro tuto nabídku.",
      };
    }

    const toBalance = getResourceValue(toUser, offer.requestType);
    if (toBalance < offer.requestAmount) {
      return {
        ok: false,
        status: 400 as const,
        message: "Nemáš dostatek zdrojů pro přijetí této nabídky.",
      };
    }

    const toReceiveCap = getResourceCap(offer.offerType);
    const toReceiveCurrent = getResourceValue(toUser, offer.offerType);
    if (toReceiveCurrent + offer.offerAmount > toReceiveCap) {
      return {
        ok: false,
        status: 400 as const,
        message: `Přijetí nabídky by překročilo tvůj limit (${toReceiveCap}) pro ${offer.offerType === "MONEY" ? "peníze" : "sílu"}.`,
      };
    }

    if (offer.requestAmount > 0) {
      const fromReceiveCap = getResourceCap(offer.requestType);
      const fromReceiveCurrent = getResourceValue(fromUser, offer.requestType);
      if (fromReceiveCurrent + offer.requestAmount > fromReceiveCap) {
        return {
          ok: false,
          status: 400 as const,
          message: `Nabídku nelze přijmout: druhé straně by se překročil limit (${fromReceiveCap}) pro ${offer.requestType === "MONEY" ? "peníze" : "sílu"}.`,
        };
      }
    }

    const fromOfferUpdate = await tx.user.updateMany({
      where: {
        id: fromUser.id,
        ...(offer.offerType === "MONEY"
          ? { money: { gte: offer.offerAmount } }
          : { power: { gte: offer.offerAmount } }),
      },
      data: {
        ...(offer.offerType === "MONEY"
          ? { money: { decrement: offer.offerAmount } }
          : { power: { decrement: offer.offerAmount } }),
      },
    });

    if (fromOfferUpdate.count !== 1) {
      return {
        ok: false,
        status: 409 as const,
        message: "Nabídka se mezitím změnila. Zkus to znovu.",
      };
    }

    if (offer.requestAmount > 0) {
      const toRequestUpdate = await tx.user.updateMany({
        where: {
          id: toUser.id,
          ...(offer.requestType === "MONEY"
            ? { money: { gte: offer.requestAmount } }
            : { power: { gte: offer.requestAmount } }),
        },
        data: {
          ...(offer.requestType === "MONEY"
            ? { money: { decrement: offer.requestAmount } }
            : { power: { decrement: offer.requestAmount } }),
        },
      });

      if (toRequestUpdate.count !== 1) {
        return {
          ok: false,
          status: 409 as const,
          message: "Nemáš už dostatek zdrojů. Obnov stránku a zkus to znovu.",
        };
      }
    }

    await tx.user.update({
      where: { id: toUser.id },
      data: {
        ...(offer.offerType === "MONEY"
          ? { money: { increment: offer.offerAmount } }
          : { power: { increment: offer.offerAmount } }),
      },
    });

    if (offer.requestAmount > 0) {
      await tx.user.update({
        where: { id: fromUser.id },
        data: {
          ...(offer.requestType === "MONEY"
            ? { money: { increment: offer.requestAmount } }
            : { power: { increment: offer.requestAmount } }),
        },
      });
    }

    await tx.tradeOffer.update({
      where: { id: offer.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    return {
      ok: true,
      status: 200 as const,
      message: "Nabídka byla přijata a transakce proběhla.",
    };
  });

  return Response.json(
    { ok: result.ok, message: result.message },
    { status: result.status },
  );
}
