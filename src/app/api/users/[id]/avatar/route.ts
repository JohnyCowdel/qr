import { db } from "@/lib/db";
import { buildAvatarSpriteDataUrl } from "@/lib/avatar-sprites";

function hasMatchingEtag(request: Request, etag: string) {
  const ifNoneMatch = request.headers.get("if-none-match");
  if (!ifNoneMatch) return false;
  return ifNoneMatch
    .split(",")
    .map((value) => value.trim())
    .includes(etag);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return new Response("Not found", { status: 404 });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { avatarType: true, avatarSeed: true, avatarPhotoDataUrl: true, handle: true, updatedAt: true },
  });

  if (!user) {
    return new Response("Not found", { status: 404 });
  }

  if (user.avatarType === "photo" && user.avatarPhotoDataUrl) {
    // Parse "data:<mime>;base64,<data>"
    const match = user.avatarPhotoDataUrl.match(/^data:(image\/[a-z+]+);base64,([^,\n]+)/);
    if (match) {
      const [, mimeType, base64Data] = match;
      const etag = `W/"avatar-photo-${userId}-${user.updatedAt.getTime()}"`;

      if (hasMatchingEtag(request, etag)) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: etag,
            "Cache-Control": "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400",
          },
        });
      }

      const buffer = Buffer.from(base64Data, "base64");
      return new Response(buffer, {
        headers: {
          "Content-Type": mimeType,
          ETag: etag,
          "Cache-Control": "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400",
        },
      });
    }
  }

  // Fallback: redirect to sprite URL so browser caches it too
  const seed = user.avatarSeed?.trim() || `${user.handle}-${userId}`;
  const spriteUrl = buildAvatarSpriteDataUrl(seed);
  const etag = `W/"avatar-sprite-${userId}-${user.updatedAt.getTime()}"`;

  if (hasMatchingEtag(request, etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: spriteUrl,
      ETag: etag,
      "Cache-Control": "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
