import { generateMeetingBrief, type MeetingBriefResult } from "@/lib/ai/claude";
import { sendDiscordBrief, type DiscordSendResult } from "@/lib/discord/notify";
import { transcriptToPlainText, type FathomTranscriptEntry } from "@/lib/fathom/payload";
import { createMeetingDoc, isGoogleConfigured } from "@/lib/google/docs";
import { getAdminClient, type AdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert } from "@/lib/types/database";

const CHANNEL = "discord";
const GOOGLE_CHANNEL = "google_docs";
const GOOGLE_TARGET = "google_drive";
const LANGUAGE = "es";

export type ProcessParams = { recordingId: number; webhookId?: string | null };

export type ProcessResult =
  | { ok: true; recordingId: number }
  | { ok: false; error: string };

type MeetingContext = {
  title: string;
  shareUrl: string | null;
  summaryMarkdown: string | null;
  startedAt: string | null;
  recordedByName: string | null;
  googleDocId: string | null;
  transcript: string;
  participants: string[];
  actionItems: string[];
};

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

function toTranscriptEntries(value: Json | null): FathomTranscriptEntry[] {
  return Array.isArray(value) ? (value as unknown as FathomTranscriptEntry[]) : [];
}

async function loadContext(
  db: AdminClient,
  recordingId: number,
): Promise<MeetingContext | null> {
  const meeting = await db
    .from("meetings")
    .select(
      "title, share_url, transcript, default_summary_markdown, recording_start_time, recorded_by_name, google_doc_id",
    )
    .eq("recording_id", recordingId)
    .maybeSingle();

  if (meeting.error || !meeting.data) return null;

  const invitees = await db
    .from("meeting_invitees")
    .select("name, email")
    .eq("recording_id", recordingId);

  const actions = await db
    .from("action_items")
    .select("description")
    .eq("recording_id", recordingId);

  return {
    title: meeting.data.title,
    shareUrl: meeting.data.share_url,
    summaryMarkdown: meeting.data.default_summary_markdown,
    startedAt: meeting.data.recording_start_time,
    recordedByName: meeting.data.recorded_by_name,
    googleDocId: meeting.data.google_doc_id,
    transcript: transcriptToPlainText(toTranscriptEntries(meeting.data.transcript)),
    participants: (invitees.data ?? [])
      .map((row) => row.name ?? row.email ?? "")
      .filter((name) => name.length > 0),
    actionItems: (actions.data ?? []).map((row) => row.description),
  };
}

async function saveInsights(
  db: AdminClient,
  recordingId: number,
  result: Extract<MeetingBriefResult, { ok: true }>,
): Promise<void> {
  const row: TablesInsert<"meeting_insights"> = {
    recording_id: recordingId,
    model: result.model,
    language: LANGUAGE,
    headline: result.brief.headline,
    executive_summary: result.brief.executive_summary,
    key_decisions: result.brief.key_decisions,
    risks: result.brief.risks,
    next_steps: result.brief.next_steps,
    sentiment: result.brief.sentiment,
    raw_response: result.raw,
  };

  const { error } = await db
    .from("meeting_insights")
    .upsert(row, { onConflict: "recording_id,model" });
  if (error) console.error("meeting_insights upsert failed:", error.message);
}

/** Re-runnable: `attempts` is read back so a retry increments instead of resetting. */
async function recordDelivery(
  db: AdminClient,
  recordingId: number,
  channel: string,
  outcome: DiscordSendResult,
): Promise<void> {
  const existing = await db
    .from("deliveries")
    .select("attempts")
    .eq("recording_id", recordingId)
    .eq("channel", channel)
    .maybeSingle();

  const now = new Date().toISOString();
  const row: TablesInsert<"deliveries"> = {
    recording_id: recordingId,
    channel,
    status: outcome.ok ? "sent" : "failed",
    target: outcome.target,
    error: outcome.ok ? null : outcome.error,
    attempts: (existing.data?.attempts ?? 0) + 1,
    sent_at: outcome.ok ? now : null,
    updated_at: now,
  };

  const { error } = await db
    .from("deliveries")
    .upsert(row, { onConflict: "recording_id,channel" });
  if (error) console.error("deliveries upsert failed:", error.message);
}

async function saveDocRef(
  db: AdminClient,
  recordingId: number,
  docId: string,
  docUrl: string,
): Promise<void> {
  const { error } = await db
    .from("meetings")
    .update({
      google_doc_id: docId,
      google_doc_url: docUrl,
      google_doc_synced_at: new Date().toISOString(),
    })
    .eq("recording_id", recordingId);
  if (error) console.error("meetings google doc update failed:", error.message);
}

/**
 * Espejo en Google Drive. Nunca puede tumbar el pipeline:
 * - si la reunión ya tiene `google_doc_id` no se hace nada, así que re-ejecutar
 *   el proceso —algo rutinario aquí— jamás duplica documentos;
 * - si Google no está configurado se sale sin dejar una entrega fallida;
 * - cualquier otro fallo se registra en `deliveries` y Discord sigue su curso.
 */
async function syncGoogleDoc(
  db: AdminClient,
  recordingId: number,
  context: MeetingContext,
  brief: Extract<MeetingBriefResult, { ok: true }>["brief"] | null,
): Promise<void> {
  if (context.googleDocId) return;
  if (!isGoogleConfigured()) return;

  try {
    const result = await createMeetingDoc({
      title: context.title,
      startedAt: context.startedAt,
      shareUrl: context.shareUrl,
      recordedByName: context.recordedByName,
      brief: brief
        ? {
            headline: brief.headline,
            executiveSummary: brief.executive_summary,
            keyDecisions: brief.key_decisions,
            risks: brief.risks,
            nextSteps: brief.next_steps,
            sentiment: brief.sentiment ?? null,
          }
        : null,
      fathomSummaryMarkdown: context.summaryMarkdown,
      actionItems: context.actionItems,
      attendees: context.participants,
      transcript: context.transcript,
    });

    if (result.ok) await saveDocRef(db, recordingId, result.docId, result.docUrl);

    await recordDelivery(
      db,
      recordingId,
      GOOGLE_CHANNEL,
      result.ok
        ? { ok: true, target: result.docUrl }
        : { ok: false, target: GOOGLE_TARGET, error: result.reason },
    );
  } catch (error) {
    console.error(`google docs sync failed for recording ${recordingId}: ${toMessage(error)}`);
  }
}

async function stampEvent(
  db: AdminClient,
  webhookId: string | null | undefined,
  failure: string | null,
): Promise<void> {
  if (!webhookId) return;
  const { error } = await db
    .from("webhook_events")
    .update({
      processed_at: failure ? null : new Date().toISOString(),
      process_error: failure,
    })
    .eq("webhook_id", webhookId);
  if (error) console.error("webhook_events stamp failed:", error.message);
}

async function fail(
  db: AdminClient,
  params: ProcessParams,
  error: string,
): Promise<ProcessResult> {
  console.error(`process failed for recording ${params.recordingId}: ${error}`);
  await stampEvent(db, params.webhookId, error);
  return { ok: false, error };
}

/**
 * Brief -> insights -> Google Doc -> Discord -> delivery record -> event stamp.
 *
 * Safe to re-run: every write is an upsert, the Doc is only created when the meeting has
 * no `google_doc_id` yet, and a Gemini, Google or Discord failure is recorded in
 * `deliveries` / `webhook_events` without touching the already-persisted meeting. A
 * Google failure never blocks the Discord delivery.
 */
export async function processMeeting(params: ProcessParams): Promise<ProcessResult> {
  const db = getAdminClient();

  try {
    const context = await loadContext(db, params.recordingId);
    if (!context) return await fail(db, params, "meeting_not_found");

    // Re-running is routine — the backfill button re-walks every meeting. Without these
    // two guards a second pass would pay Anthropic for a brief that already exists and,
    // worse, post the same brief to Discord again. Only the missing work should happen.
    const [existingInsight, existingDelivery] = await Promise.all([
      db
        .from("meeting_insights")
        .select("recording_id")
        .eq("recording_id", params.recordingId)
        .maybeSingle(),
      db
        .from("deliveries")
        .select("status")
        .eq("recording_id", params.recordingId)
        .eq("channel", CHANNEL)
        .maybeSingle(),
    ]);

    const alreadyBriefed = existingInsight.data !== null;
    const alreadyDelivered = existingDelivery.data?.status === "sent";

    if (alreadyBriefed) {
      // Nothing left but the Drive mirror, which skips itself when the doc exists.
      await syncGoogleDoc(db, params.recordingId, context, null);
      if (alreadyDelivered) {
        await stampEvent(db, params.webhookId, null);
        return { ok: true, recordingId: params.recordingId };
      }
    }

    const brief = await generateMeetingBrief({
      title: context.title,
      transcript: context.transcript,
      summaryMarkdown: context.summaryMarkdown,
      actionItems: context.actionItems,
      participants: context.participants,
    });

    if (!brief.ok) {
      // The document does not depend on the brief: the transcript, the action items,
      // the attendees and Fathom's own summary are all already in hand. Mirroring it
      // here means a Gemini outage costs the brief, not the document too.
      await syncGoogleDoc(db, params.recordingId, context, null);
      await recordDelivery(db, params.recordingId, CHANNEL, {
        ok: false,
        target: CHANNEL,
        error: brief.reason,
      });
      return await fail(db, params, brief.reason);
    }

    await saveInsights(db, params.recordingId, brief);
    await syncGoogleDoc(db, params.recordingId, context, brief.brief);

    const delivery = await sendDiscordBrief({
      title: context.title,
      shareUrl: context.shareUrl,
      headline: brief.brief.headline,
      executiveSummary: brief.brief.executive_summary,
      keyDecisions: brief.brief.key_decisions,
      risks: brief.brief.risks,
      nextSteps: brief.brief.next_steps,
      sentiment: brief.brief.sentiment,
    });

    await recordDelivery(db, params.recordingId, CHANNEL, delivery);
    if (!delivery.ok) return await fail(db, params, delivery.error);

    await stampEvent(db, params.webhookId, null);
    return { ok: true, recordingId: params.recordingId };
  } catch (error) {
    return await fail(db, params, toMessage(error));
  }
}
