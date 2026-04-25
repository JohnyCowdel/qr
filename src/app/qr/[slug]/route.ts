import QRCode from "qrcode";

import { db } from "@/lib/db";

export async function GET(
  request: Request,
  context: RouteContext<"/qr/[slug]">,
) {
  const { slug } = await context.params;
  const location = await db.location.findUnique({
    where: { slug },
    select: { slug: true },
  });

  if (!location) {
    return new Response("Not found", { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const svg = await QRCode.toString(`${origin}/l/${location.slug}`, {
    type: "svg",
    margin: 1,
    width: 512,
    color: {
      dark: "#1a2d21",
      light: "#ffffff",
    },
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}