const ALLOWED_SPRITES = new Set(["camp1.svg", "mine1.svg", "settlement8.svg"]);

type PageProps = { params: Promise<{ name: string }> };

export async function GET(_request: Request, { params }: PageProps) {
  const { name } = await params;
  const normalizedName = String(name || "").trim();

  if (!ALLOWED_SPRITES.has(normalizedName)) {
    return new Response("Sprite not found.", { status: 404 });
  }

  return new Response(null, {
    status: 308,
    headers: {
      Location: `/sprites/${normalizedName}`,
      "Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=604800, immutable",
    },
  });
}
