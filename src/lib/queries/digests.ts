import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

import { toTextList, unwrap } from "./meetings";

/**
 * Digest de las llamadas para el chat.
 *
 * Vive aparte de `meetings.ts` porque aquel fichero ya roza las quinientas líneas y
 * esto sirve a una pantalla distinta. Reutiliza `unwrap` y `toTextList` de allí en
 * vez de duplicarlos: las lecturas del panel siguen exactamente como estaban.
 */

export type DigestCommitment = {
  description: string;
  assigneeName: string | null;
};

/**
 * Lo que el modelo necesita saber de una llamada para responder sobre ella: de qué
 * iba, cuándo fue, quién la grabó, qué concluyó el brief y qué quedó abierto. Sin
 * transcripción a propósito —no cabrían veinte en el contexto y el brief ya lleva
 * la sustancia—.
 */
export type MeetingDigest = {
  recordingId: number;
  title: string;
  startedAt: string | null;
  recordedByName: string | null;
  headline: string | null;
  executiveSummary: string | null;
  keyDecisions: string[];
  risks: string[];
  nextSteps: string[];
  sentiment: string | null;
  openCommitments: DigestCommitment[];
};

type InsightRow = {
  recording_id: number;
  headline: string | null;
  executive_summary: string | null;
  key_decisions: Json;
  risks: Json;
  next_steps: Json;
  sentiment: string | null;
};

/** Las filas llegan por fecha descendente: la primera de cada reunión es la vigente. */
function latestInsightByMeeting(rows: readonly InsightRow[]): Map<number, InsightRow> {
  const map = new Map<number, InsightRow>();
  for (const row of rows) {
    if (!map.has(row.recording_id)) map.set(row.recording_id, row);
  }
  return map;
}

type CommitmentRow = {
  recording_id: number;
  description: string;
  assignee_name: string | null;
};

function groupCommitments(rows: readonly CommitmentRow[]): Map<number, DigestCommitment[]> {
  const map = new Map<number, DigestCommitment[]>();
  for (const row of rows) {
    const list = map.get(row.recording_id) ?? [];
    list.push({ description: row.description, assigneeName: row.assignee_name });
    map.set(row.recording_id, list);
  }
  return map;
}

/**
 * Todas las llamadas archivadas en tres consultas agrupadas por `recording_id`,
 * nunca una por reunión.
 */
export async function listMeetingDigests(limit = 60): Promise<MeetingDigest[]> {
  const db = getAdminClient();

  const meetings = unwrap(
    await db
      .from("meetings")
      .select("recording_id, title, recorded_by_name, recording_start_time, scheduled_start_time")
      .order("recording_start_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    "las reuniones",
  );

  if (meetings.length === 0) return [];

  const ids = meetings.map((meeting) => meeting.recording_id);

  const [insightRows, actionRows] = await Promise.all([
    db
      .from("meeting_insights")
      .select(
        "recording_id, headline, executive_summary, key_decisions, risks, next_steps, sentiment",
      )
      .in("recording_id", ids)
      .order("created_at", { ascending: false }),
    db
      .from("action_items")
      .select("recording_id, description, assignee_name")
      .in("recording_id", ids)
      .eq("completed", false),
  ]);

  const insights = latestInsightByMeeting(unwrap(insightRows, "los briefs"));
  const commitments = groupCommitments(unwrap(actionRows, "las tareas abiertas"));

  return meetings.map((meeting) => {
    const insight = insights.get(meeting.recording_id);
    return {
      recordingId: meeting.recording_id,
      title: meeting.title,
      startedAt: meeting.recording_start_time ?? meeting.scheduled_start_time,
      recordedByName: meeting.recorded_by_name,
      headline: insight?.headline ?? null,
      executiveSummary: insight?.executive_summary ?? null,
      keyDecisions: toTextList(insight?.key_decisions),
      risks: toTextList(insight?.risks),
      nextSteps: toTextList(insight?.next_steps),
      sentiment: insight?.sentiment ?? null,
      openCommitments: commitments.get(meeting.recording_id) ?? [],
    } satisfies MeetingDigest;
  });
}
