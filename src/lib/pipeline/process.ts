import { generateMeetingBrief, type MeetingBriefResult } from "@/lib/ai/gemini";
import { sendDiscordBrief, type DiscordSendResult } from "@/lib/discord/notify";
import { transcriptToPlainText, type FathomTranscriptEntry } from "@/lib/fathom/payload";
import { getAdminClient, type AdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert } from "@/lib/types/database";

const CHANNEL = "discord";
const LANGUAGE = "es";

export type ProcessParams = { recordingId: number; webhookId?: string | null };

export type ProcessResult =
  | { ok: true; recordingId: number }
  | { ok: false; error: string };

type MeetingContext = {
  title: string;
  shareUrl: string | null;
  summaryMarkdown: string | null;
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
    .select("title, share_url, transcript, default_summary_markdown")
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
  outcome: DiscordSendResult,
): Promise<void> {
  const existing = await db
    .from("deliveries")
    .select("attempts")
    .eq("recording_id", recordingId)
    .eq("channel", CHANNEL)
    .maybeSingle();

  const now = new Date().toISOString();
  const row: TablesInsert<"deliveries"> = {
    recording_id: recordingId,
    channel: CHANNEL,
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
 * Brief -> insights -> Discord -> delivery record -> event stamp.
 *
 * Safe to re-run: every write is an upsert, and a Gemini or Discord failure is recorded
 * in `deliveries` / `webhook_events` without touching the already-persisted meeting.
 */
export async function processMeeting(params: ProcessParams): Promise<ProcessResult> {
  const db = getAdminClient();

  try {
    const context = await loadContext(db, params.recordingId);
    if (!context) return await fail(db, params, "meeting_not_found");

    const brief = await generateMeetingBrief({
      title: context.title,
      transcript: context.transcript,
      summaryMarkdown: context.summaryMarkdown,
      actionItems: context.actionItems,
      participants: context.participants,
    });

    if (!brief.ok) {
      await recordDelivery(db, params.recordingId, {
        ok: false,
        target: CHANNEL,
        error: brief.reason,
      });
      return await fail(db, params, brief.reason);
    }

    await saveInsights(db, params.recordingId, brief);

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

    await recordDelivery(db, params.recordingId, delivery);
    if (!delivery.ok) return await fail(db, params, delivery.error);

    await stampEvent(db, params.webhookId, null);
    return { ok: true, recordingId: params.recordingId };
  } catch (error) {
    return await fail(db, params, toMessage(error));
  }
}
