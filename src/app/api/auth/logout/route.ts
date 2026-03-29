import { USER_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  const headers = new Headers();
  headers.set("Set-Cookie", `${USER_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    headers.set("Location", "/auth/login");
    return new Response(null, { status: 303, headers });
  }

  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
