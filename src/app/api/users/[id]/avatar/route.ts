import { db } from "@/lib/db";
import { buildAvatarSpriteDataUrl } from "@/lib/avatar-sprites";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { avatarType: true, avatarSeed: true, avatarPhotoDataUrl: true, handle: true },
  });

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  if (user.avatarType === "photo" && user.avatarPhotoDataUrl) {
    // Parse "data:<mime>;base64,<data>"
    const match = user.avatarPhotoDataUrl.match(/^data:(image\/[a-z+]+);base64,([^,\n]+)/);
    if (match) {
      const [, mimeType, base64Data] = match;
      const buffer = Buffer.from(base64Data, "base64");
      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
        },
      });
    }
  }

  // Fallback: redirect to sprite URL so browser caches it too
  const seed = user.avatarSeed?.trim() || `${user.handle}-${userId}`;
  const spriteUrl = buildAvatarSpriteDataUrl(seed);
  return Response.redirect(spriteUrl, 302);
}
