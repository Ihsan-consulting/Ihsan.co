import { describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";

// Base64 of the literal phrase "test-secret-for-fathom-webhooks" — not a real secret.
const { SECRET } = vi.hoisted(() => ({
  SECRET: "whsec_dGVzdC1zZWNyZXQtZm9yLWZhdGhvbS13ZWJob29rcw==",
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ FATHOM_WEBHOOK_SECRET: SECRET }),
}));

const { verifyFathomSignature, readWebhookId } = await import("@/lib/fathom/verify");

const BODY = JSON.stringify({
  recording_id: 987654321,
  title: "Kickoff Cliente Demo",
  url: "https://fathom.video/share/demo",
  scheduled_start_time: "2026-09-24T15:00:00.000Z",
});

function signedHeaders(body: string, id = "msg_2abc123"): Headers {
  const timestamp = new Date();
  const signature = new Webhook(SECRET).sign(id, timestamp, body);
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": signature,
  });
}

describe("verifyFathomSignature", () => {
  it("acepta un cuerpo firmado con el mismo secreto y devuelve el payload", () => {
    const result = verifyFathomSignature(BODY, signedHeaders(BODY));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.webhookId).toBe("msg_2abc123");
    expect(result.payload).toMatchObject({ recording_id: 987654321 });
  });

  it("rechaza el cuerpo alterado después de firmar", () => {
    const headers = signedHeaders(BODY);
    const tampered = JSON.stringify({ recording_id: 111111111 });

    const result = verifyFathomSignature(tampered, headers);

    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("rechaza cuando faltan las cabeceras de firma", () => {
    const headers = new Headers({ "content-type": "application/json" });

    const result = verifyFathomSignature(BODY, headers);

    expect(result).toEqual({ ok: false, reason: "missing_signature_headers" });
  });

  it("distingue un cuerpo firmado pero no parseable como JSON", () => {
    const raw = "no-json-aqui";

    const result = verifyFathomSignature(raw, signedHeaders(raw));

    expect(result).toEqual({ ok: false, reason: "malformed_json" });
  });
});

describe("readWebhookId", () => {
  it("lee el id tanto de webhook-id como de svix-id", () => {
    expect(readWebhookId(new Headers({ "webhook-id": "msg_2abc123" }))).toBe("msg_2abc123");
    expect(readWebhookId(new Headers({ "svix-id": "msg_legacy" }))).toBe("msg_legacy");
    expect(readWebhookId(new Headers())).toBeNull();
  });
});
