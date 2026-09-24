import { Webhook } from "svix";
import { getEnv } from "@/lib/env";

/**
 * Fathom signs `new-meeting-content-ready` with the Svix standard-webhooks headers.
 * Older/branded integrations send the same values under `svix-*`, so both spellings are
 * accepted — the signature itself is identical either way.
 */
const HEADER_ALIASES = {
  id: ["webhook-id", "svix-id"],
  timestamp: ["webhook-timestamp", "svix-timestamp"],
  signature: ["webhook-signature", "svix-signature"],
} as const;

export type FathomVerifyFailure =
  | "missing_signature_headers"
  | "invalid_signature"
  | "malformed_json";

export type FathomVerifyResult =
  | { ok: true; webhookId: string; payload: unknown }
  | { ok: false; reason: FathomVerifyFailure };

function pick(headers: Headers, names: readonly string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

/** The delivery id doubles as our idempotency key in `webhook_events.webhook_id`. */
export function readWebhookId(headers: Headers): string | null {
  return pick(headers, HEADER_ALIASES.id);
}

/**
 * Verifies the HMAC against the *raw* body bytes and only then parses them.
 *
 * `svix@2`'s `verify()` returns `undefined` (it only throws on a bad signature), so the
 * payload is JSON-parsed here from the exact string that was signed — never from a
 * re-serialized object, which would change the bytes and break verification.
 */
export function verifyFathomSignature(
  rawBody: string,
  headers: Headers,
): FathomVerifyResult {
  const id = pick(headers, HEADER_ALIASES.id);
  const timestamp = pick(headers, HEADER_ALIASES.timestamp);
  const signature = pick(headers, HEADER_ALIASES.signature);

  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "missing_signature_headers" };
  }

  try {
    new Webhook(getEnv().FATHOM_WEBHOOK_SECRET).verify(rawBody, {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });
  } catch {
    // Deliberately opaque: the thrown message can echo signature material.
    return { ok: false, reason: "invalid_signature" };
  }

  try {
    return { ok: true, webhookId: id, payload: JSON.parse(rawBody) as unknown };
  } catch {
    return { ok: false, reason: "malformed_json" };
  }
}
