import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  secretsMatch,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

/**
 * Per-instance throttle. Serverless spreads requests across instances and recycles them,
 * so this raises the cost of a naive script rather than making guessing impossible — the
 * real protection is the 24-char minimum enforced on DASHBOARD_PASSWORD in env.ts.
 */
const failures = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  // Vercel's own header is proxy-authoritative; x-forwarded-for can be client-supplied.
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function isThrottled(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const entry = failures.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    failures.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/**
 * Resolves `next` against a throwaway origin and keeps it only if it stayed there.
 *
 * A string-prefix check is not enough: the WHATWG parser treats a backslash as a slash
 * for special schemes, so `/\evil.com` starts with a single "/" yet resolves to
 * `https://evil.com/`. Round-tripping through the parser is the only check that agrees
 * with what `NextResponse.redirect` will actually do.
 */
export function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value === "") return "/";
  try {
    const probe = new URL(value, "https://x.invalid");
    return probe.origin === "https://x.invalid" ? probe.pathname + probe.search : "/";
  } catch {
    return "/";
  }
}

function backToLogin(request: Request, next: string, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  if (next !== "/") url.searchParams.set("next", next);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  const env = getEnv();
  const ip = clientIp(request);

  const form = await request.formData();
  const next = safeNext(form.get("next"));

  if (isThrottled(ip)) {
    return backToLogin(request, next, "rate");
  }

  const password = form.get("password");
  const accepted =
    typeof password === "string" &&
    (await secretsMatch(env.SESSION_SECRET, password, env.DASHBOARD_PASSWORD));

  if (!accepted) {
    recordFailure(ip);
    return backToLogin(request, next, "credentials");
  }

  failures.delete(ip);

  const response = NextResponse.redirect(new URL(next, request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, await createSessionToken(env.SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
