import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const SESSION_MAX_AGE = 60 * 60 * 8;
const SESSION_COOKIE = "admin_session";
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

type LoginAttempt = { count: number; firstAttemptAt: number };
const loginAttempts = new Map<string, LoginAttempt>();

function getPasswordHash() {
  const configuredHash = process.env.ADMIN_PASSWORD_HASH;
  return configuredHash ? configuredHash.toLowerCase() : null;
}

export function hashAdminPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSignature(payload: string) {
  const secret = getPasswordHash();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createAdminSession() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${issuedAt}.${randomBytes(24).toString("base64url")}`;
  const signature = sessionSignature(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

function isValidSession(value: string | undefined) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [issuedAtValue, nonce, signature] = parts;
  const issuedAt = Number(issuedAtValue);
  if (!Number.isInteger(issuedAt) || !nonce || !signature) return false;
  if (Math.floor(Date.now() / 1000) - issuedAt > SESSION_MAX_AGE || issuedAt > Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expectedSignature = sessionSignature(`${issuedAtValue}.${nonce}`);
  return expectedSignature !== null && safeEqual(signature, expectedSignature);
}

function requestAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function isLoginRateLimited(request: Request) {
  const address = requestAddress(request);
  const attempt = loginAttempts.get(address);
  if (!attempt) return false;
  if (Date.now() - attempt.firstAttemptAt >= LOGIN_WINDOW_MS) {
    loginAttempts.delete(address);
    return false;
  }
  return attempt.count >= LOGIN_MAX_ATTEMPTS;
}

export function recordLoginAttempt(request: Request, successful: boolean) {
  const address = requestAddress(request);
  if (successful) {
    loginAttempts.delete(address);
    return;
  }

  const now = Date.now();
  const previous = loginAttempts.get(address);
  const attempt = previous && now - previous.firstAttemptAt < LOGIN_WINDOW_MS
    ? previous
    : { count: 0, firstAttemptAt: now };
  attempt.count += 1;
  loginAttempts.set(address, attempt);
}

export function verifyAdminPassword(password: string) {
  const configuredHash = getPasswordHash();
  return configuredHash !== null && safeEqual(hashAdminPassword(password), configuredHash);
}

export function requireAdminPassword(request: Request): NextResponse | null {
  if (!getPasswordHash()) {
    return NextResponse.json({ error: "Configurare ADMIN_PASSWORD_HASH richiesta" }, { status: 503 });
  }

  const sessionCookie = request.headers.get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (isValidSession(sessionCookie)) return null;

  return NextResponse.json({ error: "Sessione admin non valida o scaduta" }, { status: 401 });
}

export function hasValidAdminSession(value: string | undefined) {
  return Boolean(getPasswordHash() && isValidSession(value));
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
