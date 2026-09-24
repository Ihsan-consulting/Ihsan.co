import { describe, expect, it, vi } from "vitest";

import {
  createSessionToken,
  secretsMatch,
  timingSafeEqual,
  verifySessionToken,
} from "@/lib/auth/session";

vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    SESSION_SECRET: "s".repeat(32),
    DASHBOARD_PASSWORD: "p".repeat(24),
  }),
}));

const { safeNext } = await import("@/app/api/auth/login/route");

const SECRET = "s".repeat(32);

function encodePayload(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("verifySessionToken", () => {
  it("accepts a token it just issued", async () => {
    const token = await createSessionToken(SECRET);
    await expect(verifySessionToken(SECRET, token)).resolves.toBe(true);
  });

  it("rejects a token whose signature was tampered with", async () => {
    const token = await createSessionToken(SECRET);
    const [payload, signature] = token.split(".");
    const flipped = signature.startsWith("A")
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;
    await expect(verifySessionToken(SECRET, `${payload}.${flipped}`)).resolves.toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("o".repeat(32));
    await expect(verifySessionToken(SECRET, token)).resolves.toBe(false);
  });

  it("rejects an expired token even when correctly signed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await createSessionToken(SECRET);
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z")); // +24h, past the 12h max age
    const result = await verifySessionToken(SECRET, token);
    vi.useRealTimers();
    expect(result).toBe(false);
  });

  it("rejects a payload with no exp claim", async () => {
    const issued = await createSessionToken(SECRET);
    const signature = issued.split(".")[1];
    const payload = encodePayload({ user: "admin" });
    await expect(verifySessionToken(SECRET, `${payload}.${signature}`)).resolves.toBe(false);
  });

  it("rejects undefined and malformed tokens", async () => {
    await expect(verifySessionToken(SECRET, undefined)).resolves.toBe(false);
    await expect(verifySessionToken(SECRET, "")).resolves.toBe(false);
    await expect(verifySessionToken(SECRET, "nodot")).resolves.toBe(false);
    await expect(verifySessionToken(SECRET, ".onlysig")).resolves.toBe(false);
  });
});

describe("secretsMatch", () => {
  it("accepts the exact password", async () => {
    await expect(secretsMatch(SECRET, "correct horse", "correct horse")).resolves.toBe(true);
  });

  it("rejects a wrong password, including a correct prefix", async () => {
    await expect(secretsMatch(SECRET, "correct hors", "correct horse")).resolves.toBe(false);
    await expect(secretsMatch(SECRET, "wrong", "correct horse")).resolves.toBe(false);
    await expect(secretsMatch(SECRET, "", "correct horse")).resolves.toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("compares by content and does not shortcut on length", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

describe("safeNext", () => {
  it("keeps genuine internal paths", () => {
    expect(safeNext("/meetings")).toBe("/meetings");
    expect(safeNext("/meetings/123")).toBe("/meetings/123");
    expect(safeNext("/meetings?q=a")).toBe("/meetings?q=a");
  });

  it("rejects a backslash escape to an external host", () => {
    // new URL("/\\evil.com", base) resolves to https://evil.com/ — the exact case a
    // startsWith("/") check misses, because the string does begin with a single slash.
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("/\\\\evil.com")).toBe("/");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("http://evil.com/path")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("falls back to / for empty and non-string input", () => {
    expect(safeNext("")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  it("keeps an encoded slash as a path, not a host", () => {
    expect(safeNext("/%2f%2fevil.com")).toBe("/%2f%2fevil.com");
  });
});
