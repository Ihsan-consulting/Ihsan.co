import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";
import {
  createSupabaseMock,
  findCall,
  type OutcomeResolver,
  type RecordedCall,
} from "@/lib/testing/supabase-mock";

const { SECRET, state, scheduled, ingestMeeting, processMeeting } = vi.hoisted(() => ({
  SECRET: "whsec_dGVzdC1zZWNyZXQtZm9yLWZhdGhvbS13ZWJob29rcw==",
  state: { client: undefined as unknown },
  scheduled: [] as (() => Promise<unknown>)[],
  ingestMeeting: vi.fn(),
  processMeeting: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: (callback: () => Promise<unknown>) => {
    scheduled.push(callback);
  },
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ FATHOM_WEBHOOK_SECRET: SECRET }) }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => state.client }));
vi.mock("@/lib/pipeline/ingest", () => ({ ingestMeeting }));
vi.mock("@/lib/pipeline/process", () => ({ processMeeting }));

const { POST } = await import("@/app/api/webhooks/fathom/route");

const BODY = JSON.stringify({
  recording_id: 987654321,
  title: "Kickoff Cliente Demo",
  url: "https://fathom.video/share/demo",
  scheduled_start_time: "2026-09-24T15:00:00.000Z",
});

const DUPLICATE = {
  error: {
    message:
      'duplicate key value violates unique constraint "webhook_events_webhook_id_key"',
    code: "23505",
  },
};

function signedRequest(body: string, id = "msg_2abc123"): Request {
  const timestamp = new Date();
  return new Request("https://ihsan.co/api/webhooks/fathom", {
    method: "POST",
    body,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": new Webhook(SECRET).sign(id, timestamp, body),
    },
  });
}

function withMock(resolve?: OutcomeResolver): RecordedCall[] {
  const mock = createSupabaseMock(resolve);
  state.client = mock.client;
  return mock.calls;
}

beforeEach(() => {
  scheduled.length = 0;
  ingestMeeting.mockReset().mockResolvedValue({ ok: true, recordingId: 987654321 });
  processMeeting.mockReset().mockResolvedValue({ ok: true, recordingId: 987654321 });
  withMock();
});

describe("POST /api/webhooks/fathom", () => {
  it("responde 401 cuando la firma no es válida", async () => {
    const request = new Request("https://ihsan.co/api/webhooks/fathom", {
      method: "POST",
      body: BODY,
      headers: {
        "webhook-id": "msg_2abc123",
        "webhook-timestamp": "1790000000",
        "webhook-signature": "v1,firmaInventada",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(ingestMeeting).not.toHaveBeenCalled();
  });

  it("responde 400 cuando el payload firmado no trae recording_id", async () => {
    const response = await POST(signedRequest(JSON.stringify({ title: "sin recording id" })));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_payload",
    });
    expect(ingestMeeting).not.toHaveBeenCalled();
  });

  it("responde 200 sin reprocesar cuando el webhook-id ya existe (23505)", async () => {
    withMock((table, ops) =>
      table === "webhook_events" && ops.includes("insert")
        ? DUPLICATE
        : { data: null, error: null },
    );

    const response = await POST(signedRequest(BODY));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, duplicate: true });
    expect(ingestMeeting).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });

  it("guarda el evento, ingesta y programa el procesado en un evento nuevo", async () => {
    const calls = withMock();

    const response = await POST(signedRequest(BODY));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, recording_id: 987654321 });

    expect(findCall(calls, "webhook_events", "insert")?.args[0]?.[0]).toMatchObject({
      webhook_id: "msg_2abc123",
      event_type: "new-meeting-content-ready",
      recording_id: 987654321,
      signature_verified: true,
    });
    expect(ingestMeeting).toHaveBeenCalledTimes(1);

    expect(scheduled).toHaveLength(1);
    await scheduled[0]?.();
    expect(processMeeting).toHaveBeenCalledWith({
      recordingId: 987654321,
      webhookId: "msg_2abc123",
    });
  });

  it("libera la clave de idempotencia cuando la ingesta falla", async () => {
    const calls = withMock();
    ingestMeeting.mockResolvedValue({ ok: false, error: "meetings_upsert_failed: boom" });

    const response = await POST(signedRequest(BODY));

    expect(response.status).toBe(500);
    expect(findCall(calls, "webhook_events", "delete")).toBeDefined();
    expect(scheduled).toHaveLength(0);
  });
});
