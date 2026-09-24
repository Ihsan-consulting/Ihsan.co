import { after } from "next/server";
import { fathomWebhookPayloadSchema } from "@/lib/fathom/payload";
import { verifyFathomSignature } from "@/lib/fathom/verify";
import { ingestMeeting } from "@/lib/pipeline/ingest";
import { processMeeting } from "@/lib/pipeline/process";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPE = "new-meeting-content-ready";
/** Postgres unique_violation — this webhook_id is already stored. */
const UNIQUE_VIOLATION = "23505";

export async function POST(request: Request): Promise<Response> {
  // Must stay the raw string: the HMAC covers these exact bytes.
  const rawBody = await request.text();

  const verified = verifyFathomSignature(rawBody, request.headers);
  if (!verified.ok) {
    const status = verified.reason === "malformed_json" ? 400 : 401;
    return Response.json({ ok: false, error: verified.reason }, { status });
  }

  const parsed = fathomWebhookPayloadSchema.safeParse(verified.payload);
  if (!parsed.success) {
    // A 5xx here would make Fathom retry a payload that can never succeed.
    return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const recordingId = parsed.data.recording_id;
  const db = getAdminClient();

  const stored = await db.from("webhook_events").insert({
    webhook_id: verified.webhookId,
    event_type: EVENT_TYPE,
    recording_id: recordingId,
    payload: verified.payload as Json,
    signature_verified: true,
  });

  if (stored.error) {
    if (stored.error.code === UNIQUE_VIOLATION) {
      return Response.json({ ok: true, duplicate: true });
    }
    console.error("webhook_events insert failed:", stored.error.message);
    return Response.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
  }

  const ingested = await ingestMeeting(parsed.data);
  if (!ingested.ok) {
    console.error("fathom ingest failed:", ingested.error);
    // Release the idempotency key so Fathom's retry is treated as a fresh event
    // instead of short-circuiting on the duplicate check above.
    await db.from("webhook_events").delete().eq("webhook_id", verified.webhookId);
    return Response.json({ ok: false, error: "ingest_failed" }, { status: 500 });
  }

  // Gemini + Discord run after the response so Fathom sees a fast 2xx.
  after(async () => {
    await processMeeting({ recordingId, webhookId: verified.webhookId });
  });

  return Response.json({ ok: true, recording_id: recordingId });
}
