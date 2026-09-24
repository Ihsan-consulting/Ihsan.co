import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/lib/types/database";

/**
 * Lecturas del panel. Todo se ejecuta en servidor: las tablas tienen RLS activo
 * sin políticas, así que la clave de servicio es la única credencial que puede
 * leerlas y nunca debe llegar al navegador.
 *
 * Las relaciones se agrupan por `recording_id` con `.in(...)`: nunca una consulta
 * por reunión.
 */

export type DeliveryStatus = "pending" | "sent" | "failed";

export type MeetingSummary = {
  recordingId: number;
  title: string;
  shareUrl: string | null;
  meetingUrl: string | null;
  recordedByName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  transcriptLanguage: string | null;
  headline: string | null;
  sentiment: string | null;
  hasBrief: boolean;
  deliveryStatus: DeliveryStatus | null;
  deliveryError: string | null;
  attendeesTotal: number;
  attendeesExternal: number;
  actionItemsOpen: number;
  actionItemsTotal: number;
};

export type MeetingBrief = {
  headline: string | null;
  executiveSummary: string | null;
  keyDecisions: string[];
  risks: string[];
  nextSteps: string[];
  sentiment: string | null;
  model: string;
  language: string;
  createdAt: string;
};

export type MeetingActionItem = {
  id: string;
  description: string;
  completed: boolean;
  userGenerated: boolean | null;
  timestamp: string | null;
  playbackUrl: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
};

export type MeetingInvitee = {
  id: string;
  name: string | null;
  email: string | null;
  isExternal: boolean | null;
};

export type MeetingDelivery = {
  id: string;
  channel: string;
  status: DeliveryStatus;
  target: string | null;
  error: string | null;
  attempts: number;
  sentAt: string | null;
  updatedAt: string;
};

export type MeetingDetail = {
  recordingId: number;
  title: string;
  shareUrl: string | null;
  meetingUrl: string | null;
  transcriptLanguage: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  recordingStartTime: string | null;
  recordingEndTime: string | null;
  recordedByName: string | null;
  recordedByEmail: string | null;
  recordedByTeam: string | null;
  sharedWith: string | null;
  fathomSummaryTemplate: string | null;
  fathomSummaryMarkdown: string | null;
  hasTranscript: boolean;
  googleDocUrl: string | null;
  googleDocSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  brief: MeetingBrief | null;
  actionItems: MeetingActionItem[];
  invitees: MeetingInvitee[];
  deliveries: MeetingDelivery[];
};

export type DashboardTotals = {
  meetingsTotal: number;
  meetingsLastWeek: number;
  actionItemsOpen: number;
  briefsPending: number;
  deliveriesFailed: number;
  deliveriesPending: number;
};

export type OpenActionItem = MeetingActionItem & {
  recordingId: number;
  meetingTitle: string;
  meetingStartedAt: string | null;
};

export type ProblemDelivery = MeetingDelivery & {
  recordingId: number;
  meetingTitle: string;
};

type QueryOutcome<T> = { data: T | null; error: { message: string } | null };
type CountOutcome = { count: number | null; error: { message: string } | null };

export function unwrap<T>(outcome: QueryOutcome<T>, what: string): T {
  if (outcome.error) {
    throw new Error(`No se pudo leer ${what}: ${outcome.error.message}`);
  }
  if (outcome.data === null) {
    throw new Error(`No se pudo leer ${what}: respuesta vacía.`);
  }
  return outcome.data;
}

/** `maybeSingle()` devuelve `null` sin error cuando no hay fila: eso no es un fallo. */
function unwrapMaybe<T>(outcome: QueryOutcome<T>, what: string): T | null {
  if (outcome.error) {
    throw new Error(`No se pudo leer ${what}: ${outcome.error.message}`);
  }
  return outcome.data;
}

export function unwrapCount(outcome: CountOutcome, what: string): number {
  if (outcome.error) {
    throw new Error(`No se pudo contar ${what}: ${outcome.error.message}`);
  }
  return outcome.count ?? 0;
}

/** Las columnas jsonb no garantizan forma: normalizamos a lista de textos. */
const TEXT_KEYS = [
  "text",
  "description",
  "descripcion",
  "title",
  "titulo",
  "decision",
  "risk",
  "riesgo",
  "step",
  "paso",
  "summary",
  "resumen",
  "label",
  "item",
] as const;

export function toTextList(value: Json | null | undefined): string[] {
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (trimmed) out.push(trimmed);
      continue;
    }
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const record = entry as { [key: string]: Json | undefined };
      for (const key of TEXT_KEYS) {
        const candidate = record[key];
        if (typeof candidate === "string" && candidate.trim()) {
          out.push(candidate.trim());
          break;
        }
      }
    }
  }
  return out;
}

function toDeliveryStatus(value: string): DeliveryStatus {
  if (value === "sent" || value === "failed") return value;
  return "pending";
}

const STATUS_SEVERITY: Record<DeliveryStatus, number> = {
  failed: 3,
  pending: 2,
  sent: 1,
};

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function uniqueIds(values: number[]): number[] {
  return Array.from(new Set(values));
}

type MeetingHeading = { title: string; startedAt: string | null };

async function fetchMeetingHeadings(ids: number[]): Promise<Map<number, MeetingHeading>> {
  const map = new Map<number, MeetingHeading>();
  if (ids.length === 0) return map;

  const rows = unwrap(
    await getAdminClient()
      .from("meetings")
      .select("recording_id, title, recording_start_time, scheduled_start_time")
      .in("recording_id", ids),
    "los títulos de las reuniones",
  );

  for (const row of rows) {
    map.set(row.recording_id, {
      title: row.title,
      startedAt: row.recording_start_time ?? row.scheduled_start_time,
    });
  }
  return map;
}

export async function listMeetings(limit = 60): Promise<MeetingSummary[]> {
  const db = getAdminClient();

  const meetings = unwrap(
    await db
      .from("meetings")
      .select(
        "recording_id, title, share_url, meeting_url, recorded_by_name, recording_start_time, recording_end_time, scheduled_start_time, scheduled_end_time, transcript_language, created_at",
      )
      .order("recording_start_time", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    "las reuniones",
  );

  if (meetings.length === 0) return [];

  const ids = meetings.map((meeting) => meeting.recording_id);

  const [insightRows, deliveryRows, actionRows, inviteeRows] = await Promise.all([
    db.from("meeting_insights").select("recording_id, headline, sentiment").in("recording_id", ids),
    db.from("deliveries").select("recording_id, status, error").in("recording_id", ids),
    db.from("action_items").select("recording_id, completed").in("recording_id", ids),
    db.from("meeting_invitees").select("recording_id, is_external").in("recording_id", ids),
  ]);

  const insights = unwrap(insightRows, "los briefs");
  const deliveries = unwrap(deliveryRows, "las entregas");
  const actions = unwrap(actionRows, "las tareas");
  const invitees = unwrap(inviteeRows, "los asistentes");

  const insightByMeeting = new Map<number, { headline: string | null; sentiment: string | null }>();
  for (const row of insights) {
    if (!insightByMeeting.has(row.recording_id)) {
      insightByMeeting.set(row.recording_id, { headline: row.headline, sentiment: row.sentiment });
    }
  }

  const deliveryByMeeting = new Map<number, { status: DeliveryStatus; error: string | null }>();
  for (const row of deliveries) {
    const status = toDeliveryStatus(row.status);
    const current = deliveryByMeeting.get(row.recording_id);
    if (!current || STATUS_SEVERITY[status] > STATUS_SEVERITY[current.status]) {
      deliveryByMeeting.set(row.recording_id, { status, error: row.error });
    }
  }

  const actionsByMeeting = new Map<number, { open: number; total: number }>();
  for (const row of actions) {
    const current = actionsByMeeting.get(row.recording_id) ?? { open: 0, total: 0 };
    current.total += 1;
    if (!row.completed) current.open += 1;
    actionsByMeeting.set(row.recording_id, current);
  }

  const attendeesByMeeting = new Map<number, { total: number; external: number }>();
  for (const row of invitees) {
    const current = attendeesByMeeting.get(row.recording_id) ?? { total: 0, external: 0 };
    current.total += 1;
    if (row.is_external) current.external += 1;
    attendeesByMeeting.set(row.recording_id, current);
  }

  return meetings.map((meeting) => {
    const insight = insightByMeeting.get(meeting.recording_id);
    const delivery = deliveryByMeeting.get(meeting.recording_id);
    const counts = actionsByMeeting.get(meeting.recording_id);
    const attendees = attendeesByMeeting.get(meeting.recording_id);

    return {
      recordingId: meeting.recording_id,
      title: meeting.title,
      shareUrl: meeting.share_url,
      meetingUrl: meeting.meeting_url,
      recordedByName: meeting.recorded_by_name,
      startedAt: meeting.recording_start_time ?? meeting.scheduled_start_time,
      endedAt: meeting.recording_end_time ?? meeting.scheduled_end_time,
      createdAt: meeting.created_at,
      transcriptLanguage: meeting.transcript_language,
      headline: insight?.headline ?? null,
      sentiment: insight?.sentiment ?? null,
      hasBrief: insight !== undefined,
      deliveryStatus: delivery?.status ?? null,
      deliveryError: delivery?.error ?? null,
      attendeesTotal: attendees?.total ?? 0,
      attendeesExternal: attendees?.external ?? 0,
      actionItemsOpen: counts?.open ?? 0,
      actionItemsTotal: counts?.total ?? 0,
    } satisfies MeetingSummary;
  });
}

export async function getMeetingDetail(recordingId: number): Promise<MeetingDetail | null> {
  const db = getAdminClient();

  // `maybeSingle()` devuelve una unión discriminada; fijamos el tipo para que
  // TypeScript no lo colapse a `never` al inferirlo desde la rama sin datos.
  const meeting = unwrapMaybe<Tables<"meetings">>(
    await db.from("meetings").select("*").eq("recording_id", recordingId).maybeSingle(),
    "la reunión",
  );

  if (!meeting) return null;

  const [insightRows, actionRows, inviteeRows, deliveryRows] = await Promise.all([
    db
      .from("meeting_insights")
      .select("*")
      .eq("recording_id", recordingId)
      .order("created_at", { ascending: false })
      .limit(1),
    db
      .from("action_items")
      .select("*")
      .eq("recording_id", recordingId)
      .order("recording_timestamp", { ascending: true, nullsFirst: false }),
    db
      .from("meeting_invitees")
      .select("*")
      .eq("recording_id", recordingId)
      .order("is_external", { ascending: true }),
    db
      .from("deliveries")
      .select("*")
      .eq("recording_id", recordingId)
      .order("updated_at", { ascending: false }),
  ]);

  const insight = unwrap(insightRows, "el brief")[0];
  const actions = unwrap(actionRows, "las tareas");
  const invitees = unwrap(inviteeRows, "los asistentes");
  const deliveries = unwrap(deliveryRows, "las entregas");

  return {
    recordingId: meeting.recording_id,
    title: meeting.title,
    shareUrl: meeting.share_url,
    meetingUrl: meeting.meeting_url,
    transcriptLanguage: meeting.transcript_language,
    scheduledStartTime: meeting.scheduled_start_time,
    scheduledEndTime: meeting.scheduled_end_time,
    recordingStartTime: meeting.recording_start_time,
    recordingEndTime: meeting.recording_end_time,
    recordedByName: meeting.recorded_by_name,
    recordedByEmail: meeting.recorded_by_email,
    recordedByTeam: meeting.recorded_by_team,
    sharedWith: meeting.shared_with,
    fathomSummaryTemplate: meeting.default_summary_template,
    fathomSummaryMarkdown: meeting.default_summary_markdown,
    hasTranscript: meeting.transcript !== null,
    googleDocUrl: meeting.google_doc_url,
    googleDocSyncedAt: meeting.google_doc_synced_at,
    createdAt: meeting.created_at,
    updatedAt: meeting.updated_at,
    brief: insight
      ? {
          headline: insight.headline,
          executiveSummary: insight.executive_summary,
          keyDecisions: toTextList(insight.key_decisions),
          risks: toTextList(insight.risks),
          nextSteps: toTextList(insight.next_steps),
          sentiment: insight.sentiment,
          model: insight.model,
          language: insight.language,
          createdAt: insight.created_at,
        }
      : null,
    actionItems: actions.map((row) => ({
      id: row.id,
      description: row.description,
      completed: row.completed,
      userGenerated: row.user_generated,
      timestamp: row.recording_timestamp,
      playbackUrl: row.recording_playback_url,
      assigneeName: row.assignee_name,
      assigneeEmail: row.assignee_email,
    })),
    invitees: invitees.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      isExternal: row.is_external,
    })),
    deliveries: deliveries.map((row) => ({
      id: row.id,
      channel: row.channel,
      status: toDeliveryStatus(row.status),
      target: row.target,
      error: row.error,
      attempts: row.attempts,
      sentAt: row.sent_at,
      updatedAt: row.updated_at,
    })),
  } satisfies MeetingDetail;
}

export async function getDashboardTotals(): Promise<DashboardTotals> {
  const db = getAdminClient();
  const since = daysAgoIso(7);

  const [
    meetingsTotal,
    meetingsLastWeek,
    briefsTotal,
    actionItemsOpen,
    deliveriesFailed,
    deliveriesPending,
  ] = await Promise.all([
    db.from("meetings").select("recording_id", { count: "exact", head: true }),
    db
      .from("meetings")
      .select("recording_id", { count: "exact", head: true })
      .gte("created_at", since),
    db.from("meeting_insights").select("id", { count: "exact", head: true }),
    db.from("action_items").select("id", { count: "exact", head: true }).eq("completed", false),
    db.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.from("deliveries").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const total = unwrapCount(meetingsTotal, "las reuniones");
  const briefs = unwrapCount(briefsTotal, "los briefs");

  return {
    meetingsTotal: total,
    meetingsLastWeek: unwrapCount(meetingsLastWeek, "las reuniones recientes"),
    actionItemsOpen: unwrapCount(actionItemsOpen, "las tareas abiertas"),
    briefsPending: Math.max(total - briefs, 0),
    deliveriesFailed: unwrapCount(deliveriesFailed, "las entregas fallidas"),
    deliveriesPending: unwrapCount(deliveriesPending, "las entregas en cola"),
  };
}

export async function listOpenActionItems(limit = 8): Promise<OpenActionItem[]> {
  const db = getAdminClient();

  const rows = unwrap(
    await db
      .from("action_items")
      .select("*")
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(limit),
    "las tareas abiertas",
  );

  if (rows.length === 0) return [];

  const headings = await fetchMeetingHeadings(uniqueIds(rows.map((row) => row.recording_id)));

  return rows.map((row) => {
    const meeting = headings.get(row.recording_id);
    return {
      id: row.id,
      description: row.description,
      completed: row.completed,
      userGenerated: row.user_generated,
      timestamp: row.recording_timestamp,
      playbackUrl: row.recording_playback_url,
      assigneeName: row.assignee_name,
      assigneeEmail: row.assignee_email,
      recordingId: row.recording_id,
      meetingTitle: meeting?.title ?? `Grabación ${row.recording_id}`,
      meetingStartedAt: meeting?.startedAt ?? null,
    } satisfies OpenActionItem;
  });
}

export async function listProblemDeliveries(limit = 6): Promise<ProblemDelivery[]> {
  const db = getAdminClient();

  const rows = unwrap(
    await db
      .from("deliveries")
      .select("*")
      .in("status", ["failed", "pending"])
      .order("updated_at", { ascending: false })
      .limit(limit),
    "las entregas con incidencias",
  );

  if (rows.length === 0) return [];

  const headings = await fetchMeetingHeadings(uniqueIds(rows.map((row) => row.recording_id)));

  return rows.map((row) => ({
    id: row.id,
    channel: row.channel,
    status: toDeliveryStatus(row.status),
    target: row.target,
    error: row.error,
    attempts: row.attempts,
    sentAt: row.sent_at,
    updatedAt: row.updated_at,
    recordingId: row.recording_id,
    meetingTitle: headings.get(row.recording_id)?.title ?? `Grabación ${row.recording_id}`,
  }));
}
