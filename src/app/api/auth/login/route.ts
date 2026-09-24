import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  timingSafeEqual,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

/**
 * Per-instance throttle. Serverless spreads requests across instances, so this raises
 * the cost of guessing rather than making it impossible — the real protection is a long
 * DASHBOARD_PASSWORD. Worth having anyway: it stops the cheap single-origin script.
 */
const failures = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
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

/** Only same-site paths may be redirect targets, so `next` cannot become an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const candidate = typeof value === "string" ? value : "";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
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
  if (typeof password !== "string" || !timingSafeEqual(password, env.DASHBOARD_PASSWORD)) {
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
