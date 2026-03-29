import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const SECRET =
  process.env.ADMIN_SESSION_SECRET ?? "dev-secret-do-not-use-in-production";

export const COOKIE_NAME = "admin_session";
const SESSION_HOURS = 8;
export const SESSION_MAX_AGE = SESSION_HOURS * 3600;

// ── Session tokens ────────────────────────────────────────────────────────────

function hmac(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("hex");
}

export function createSessionToken(): string {
  const exp = (Date.now() + SESSION_HOURS * 3600 * 1000).toString(36);
  const payload = `v1:${exp}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifySessionToken(token: string): boolean {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return false;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = hmac(payload);
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
    const [, expBase36] = payload.split(":");
    return Date.now() < parseInt(expBase36, 36);
  } catch {
    return false;
  }
}

export function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return !!token && verifySessionToken(token);
}

// ── Password hashing ──────────────────────────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    const computed = scryptSync(password, salt, 64);
    const hashBuf = Buffer.from(hash, "hex");
    if (computed.length !== hashBuf.length) return false;
    return timingSafeEqual(computed, hashBuf);
  } catch {
    return false;
  }
}
