import { z } from "zod";
import { readUserIdFromCookieHeader } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendApprovalEmail } from "@/lib/email";

const approveSchema = z.object({
  userId: z.number().int().positive(),
});

export async function POST(request: Request) {
  const adminUserId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!adminUserId) {
    return Response.json(
      { ok: false, message: "Admin přihlášení je vyžadováno." },
      { status: 401 },
    );
  }

  // Kontrola, zda je uživatel admin
  const adminUser = await db.user.findUnique({
    where: { id: adminUserId },
    select: { isAdmin: true },
  });

  if (!adminUser?.isAdmin) {
    return Response.json(
      { ok: false, message: "Pouze administrátor může schvalovat hráče." },
      { status: 403 },
    );
  }

  const parsed = approveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { ok: false, message: "Neplatná data." },
      { status: 400 },
    );
  }

  const { userId } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      handle: true,
      isApproved: true,
    },
  });

  if (!user) {
    return Response.json(
      { ok: false, message: "Hráč nebyl nalezen." },
      { status: 404 },
    );
  }

  if (user.isApproved) {
    return Response.json(
      { ok: false, message: "Hráč je už schválený." },
      { status: 400 },
    );
  }

  // Aktualizace a odeslání emailu v transakci
  const result = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { isApproved: true },
      select: { email: true, handle: true },
    });

    // Odeslání emailu
    const emailResult = await sendApprovalEmail(updatedUser.email, updatedUser.handle);

    return emailResult;
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, message: "Hráč byl schválený, ale email se nepodařilo odeslat." },
      { status: 500 },
    );
  }

  return Response.json({
    ok: true,
    message: "Hráč byl schválený a email odeslán.",
  });
}
