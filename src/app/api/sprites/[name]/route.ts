import { readFile } from "fs/promises";
import path from "path";

const ALLOWED_SPRITES = new Set(["camp1.svg", "mine1.svg", "settlement8.svg"]);

type PageProps = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: PageProps) {
  const { name } = await params;
  const normalizedName = String(name || "").trim();

  if (!ALLOWED_SPRITES.has(normalizedName)) {
    return new Response("Sprite not found.", { status: 404 });
  }

  const fullPath = path.join(process.cwd(), "sprites", normalizedName);

  try {
    const content = await readFile(fullPath, "utf8");
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("Sprite not found.", { status: 404 });
  }
}
