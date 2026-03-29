import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

const SECRET =
  process.env.ADMIN_SESSION_SECRET ?? "dev-secret-do-not-use-in-production";

export const COOKIE_NAME = "admin_session";
export const USER_COOKIE_NAME = "user_session";
const SESSION_HOURS = 8;
export const SESSION_MAX_AGE = SESSION_HOURS * 3600;

// ── Session tokens ────────────────────────────────────────────────────────────

function hmac(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("hex");
}

function createSignedToken(payload: string): string {
  return `${payload}.${hmac(payload)}`;
}

function verifySignedToken(token: string): string | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = hmac(payload);
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(): string {
  const exp = (Date.now() + SESSION_HOURS * 3600 * 1000).toString(36);
  const payload = `v1:${exp}`;
  return createSignedToken(payload);
}

export function verifySessionToken(token: string): boolean {
  try {
    const payload = verifySignedToken(token);
    if (!payload) return false;
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

export function createUserSessionToken(userId: number): string {
  const exp = (Date.now() + SESSION_HOURS * 3600 * 1000).toString(36);
  const payload = `u1:${userId.toString(36)}:${exp}`;
  return createSignedToken(payload);
}

export function verifyUserSessionToken(token: string): number | null {
  try {
    const payload = verifySignedToken(token);
    if (!payload) return null;
    const [version, userIdBase36, expBase36] = payload.split(":");
    if (version !== "u1") return null;
    const userId = parseInt(userIdBase36, 36);
    const exp = parseInt(expBase36, 36);
    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(exp)) {
      return null;
    }
    if (Date.now() >= exp) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

export function readUserIdFromCookieHeader(cookieHeader: string | null | undefined): number | null {
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [rawName, ...rawValueParts] = pair.trim().split("=");
    if (rawName !== USER_COOKIE_NAME) {
      continue;
    }

    const value = rawValueParts.join("=");
    if (!value) {
      return null;
    }

    return verifyUserSessionToken(value);
  }

  return null;
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
