import { getAdminClient } from "@/lib/supabase/admin";
import { toIsoOrNull, type FathomWebhookPayload } from "@/lib/fathom/payload";
import type { Json, TablesInsert } from "@/lib/types/database";

export type IngestResult =
  | { ok: true; recordingId: number }
  | { ok: false; error: string };

/** The zod schema keeps these blocks loosely typed; the columns are plain jsonb. */
function asJson(value: unknown): Json {
  return value as Json;
}

function meetingRow(payload: FathomWebhookPayload): TablesInsert<"meetings"> {
  return {
    recording_id: payload.recording_id,
    // `title` is NOT NULL and Fathom omits it for untitled calendar holds.
    title: payload.title?.trim() || `Reunión ${payload.recording_id}`,
    meeting_url: payload.meeting_url ?? null,
    share_url: payload.url ?? null,
    transcript_language: payload.transcript_language ?? null,
    scheduled_start_time: toIsoOrNull(payload.scheduled_start_time),
    scheduled_end_time: toIsoOrNull(payload.scheduled_end_time),
    recording_start_time: toIsoOrNull(payload.recording_start_time),
    recording_end_time: toIsoOrNull(payload.recording_end_time),
    recorded_by_name: payload.recorded_by?.name ?? null,
    recorded_by_email: payload.recorded_by?.email ?? null,
    recorded_by_team: payload.recorded_by?.team ?? null,
    default_summary_template: payload.default_summary?.template_name ?? null,
    default_summary_markdown: payload.default_summary?.markdown_formatted ?? null,
    transcript: payload.transcript ? asJson(payload.transcript) : null,
    crm_matches: payload.crm_matches ? asJson(payload.crm_matches) : null,
    shared_with: payload.shared_with ?? null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Rows without an email are dropped: the unique index is (recording_id, email) and
 * Postgres treats NULLs as distinct, so they would duplicate on every Fathom retry.
 */
function inviteeRows(
  payload: FathomWebhookPayload,
): TablesInsert<"meeting_invitees">[] {
  const byEmail = new Map<string, TablesInsert<"meeting_invitees">>();

  for (const invitee of payload.calendar_invitees ?? []) {
    const email = invitee.email?.trim().toLowerCase();
    if (!email) continue;
    byEmail.set(email, {
      recording_id: payload.recording_id,
      name: invitee.name ?? null,
      email,
      is_external: invitee.is_external ?? null,
    });
  }

  return [...byEmail.values()];
}

function actionItemRows(payload: FathomWebhookPayload): TablesInsert<"action_items">[] {
  const byDescription = new Map<string, TablesInsert<"action_items">>();

  for (const item of payload.action_items ?? []) {
    const description = item.description?.trim();
    if (!description) continue;
    byDescription.set(description, {
      recording_id: payload.recording_id,
      description,
      user_generated: item.user_generated ?? null,
      completed: item.completed ?? false,
      recording_timestamp: item.recording_timestamp ?? null,
      recording_playback_url: item.recording_playback_url ?? null,
      assignee_name: item.assignee?.name ?? null,
      assignee_email: item.assignee?.email ?? null,
      assignee_team: item.assignee?.team ?? null,
    });
  }

  return [...byDescription.values()];
}

/**
 * Pure persistence — no AI, no Discord. Every write is an upsert against a unique
 * constraint, so a Fathom retry of the same recording is a no-op rather than a duplicate.
 */
export async function ingestMeeting(
  payload: FathomWebhookPayload,
): Promise<IngestResult> {
  const db = getAdminClient();
  const recordingId = payload.recording_id;

  const meeting = await db
    .from("meetings")
    .upsert(meetingRow(payload), { onConflict: "recording_id" });
  if (meeting.error) {
    return { ok: false, error: `meetings_upsert_failed: ${meeting.error.message}` };
  }

  const invitees = inviteeRows(payload);
  if (invitees.length > 0) {
    const result = await db
      .from("meeting_invitees")
      .upsert(invitees, { onConflict: "recording_id,email" });
    if (result.error) {
      return { ok: false, error: `invitees_upsert_failed: ${result.error.message}` };
    }
  }

  const actionItems = actionItemRows(payload);
  if (actionItems.length > 0) {
    const result = await db
      .from("action_items")
      .upsert(actionItems, { onConflict: "recording_id,description" });
    if (result.error) {
      return { ok: false, error: `action_items_upsert_failed: ${result.error.message}` };
    }
  }

  return { ok: true, recordingId };
}
