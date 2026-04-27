import { readUserIdFromCookieHeader } from "@/lib/auth";
import { DICEBEAR_AVATAR_STYLE } from "@/lib/avatar-sprites";
import { db } from "@/lib/db";

const MAX_PHOTO_BYTES = 200 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
function normalizeSeed(value: FormDataEntryValue | null): string {
  const raw = String(value ?? "").trim();
  if (raw) {
    return raw;
  }

  return "player";
}

export async function POST(request: Request) {
  const userId = readUserIdFromCookieHeader(request.headers.get("cookie"));
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const mode = String(formData.get("mode") ?? "sprite");

  if (mode === "sprite") {
    const avatarSeed = normalizeSeed(formData.get("seed"));

    await db.user.update({
      where: { id: userId },
      data: {
        avatarType: "sprite",
        avatarSprite: DICEBEAR_AVATAR_STYLE,
        avatarSeed,
        avatarPhotoDataUrl: null,
      },
    });

    return Response.json({ ok: true });
  }

  if (mode === "photo") {
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return Response.json({ error: "Photo file is required." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json({ error: "Use PNG, JPG, or WEBP." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "Photo must be smaller than 200 KB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    await db.user.update({
      where: { id: userId },
      data: {
        avatarType: "photo",
        avatarSeed: null,
        avatarPhotoDataUrl: dataUrl,
      },
    });

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unsupported avatar mode." }, { status: 400 });
}
