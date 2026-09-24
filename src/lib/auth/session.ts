/**
 * Signed session cookie for the internal dashboard.
 *
 * Deliberately depends on nothing but Web Crypto so the same code runs in Middleware
 * and in a Route Handler. It takes the secret as an argument instead of importing
 * `@/lib/env`, because that module is `server-only` and Middleware resolves under a
 * different condition.
 */

export const SESSION_COOKIE_NAME = "ihsan_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

/** Compares without leaking position through timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let mismatch = aBytes.length ^ bBytes.length;
  const width = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < width; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const payload = JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  });
  const encoded = toBase64Url(encoder.encode(payload));
  return `${encoded}.${await sign(secret, encoded)}`;
}

export async function verifySessionToken(
  secret: string,
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!timingSafeEqual(signature, await sign(secret, encoded))) return false;

  try {
    const { exp } = JSON.parse(fromBase64Url(encoded)) as { exp?: unknown };
    return typeof exp === "number" && exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
