import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

import { parseObjections, parsePayments, parseScore, formatMoney } from "./insights";
import { unwrap } from "./meetings";

/**
 * Alertas operativas. No hay tabla de alertas: cada una se deduce del estado real
 * del pipeline —una entrega que falló, una grabación sin ficha en `meeting_insights`
 * un compromiso que sigue abierto, una objeción reciente sin resolver, un pago
 * pendiente o una llamada con puntuación baja— y apunta siempre a su grabación.
 */

export type AlertKind =
  | "entrega"
  | "brief"
  | "pago"
  | "puntuacion"
  | "objecion"
  | "compromiso";
export type AlertSeverity = "critica" | "alta" | "abierta";

export type OperationalAlert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  recordingId: number;
  meetingTitle: string;
  occurredAt: string | null;
  /** Texto literal de la fila: el error del proveedor o el compromiso. */
  quote: string | null;
  /** Qué implica, derivado de la propia fila. Nunca es un consejo inventado. */
  detail: string;
  meta: string;
  owner: string | null;
};

export type AlertCounts = Record<AlertKind, number> & {
  total: number;
  bySeverity: Record<AlertSeverity, number>;
};

export type AlertsBoard = {
  alerts: OperationalAlert[];
  counts: AlertCounts;
};

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  entrega: "Entrega fallida",
  brief: "Grabación sin brief",
  pago: "Pago pendiente",
  puntuacion: "Llamada con puntuación baja",
  objecion: "Objeción sin resolver",
  compromiso: "Compromiso abierto",
};

export const ALERT_KINDS: ReadonlyArray<AlertKind> = [
  "entrega",
  "brief",
  "pago",
  "puntuacion",
  "objecion",
  "compromiso",
];

export const ALERT_SEVERITIES: ReadonlyArray<AlertSeverity> = ["critica", "alta", "abierta"];

/** Ventana para objeciones: las antiguas ya no son accionables. */
export const OBJECTION_WINDOW_DAYS = 14;
/** Por debajo de esta puntuación la llamada merece revisión. */
export const LOW_SCORE_THRESHOLD = 50;

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critica: "Crítica",
  alta: "Alta",
  abierta: "Abierta",
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critica: 3,
  alta: 2,
  abierta: 1,
};

function timeOf(iso: string | null): number {
  if (!iso) return 0;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/** Todas las alertas, ordenadas por gravedad y fecha. La página filtra y recorta. */
export async function getAlertsBoard(now: Date = new Date()): Promise<AlertsBoard> {
  const db = getAdminClient();

  const [meetingRows, deliveryRows, insightRows, actionRows] = await Promise.all([
    db
      .from("meetings")
      .select("recording_id, title, recording_start_time, scheduled_start_time, recorded_by_name"),
    db
      .from("deliveries")
      .select("id, recording_id, channel, status, attempts, error, sent_at, updated_at")
      .eq("status", "failed"),
    db
      .from("meeting_insights")
      .select("recording_id, created_at, call_score, objections, payments"),
    db
      .from("action_items")
      .select("id, recording_id, description, completed, assignee_name, assignee_email")
      .eq("completed", false),
  ]);

  const meetings = unwrap(meetingRows, "las reuniones");
  const failed = unwrap(deliveryRows, "las entregas fallidas");
  const insights = unwrap(insightRows, "los briefs");
  const open = unwrap(actionRows, "los compromisos abiertos");

  const titles = new Map<number, string>();
  const startedAt = new Map<number, string | null>();
  const recorders = new Map<number, string | null>();

  for (const meeting of meetings) {
    titles.set(meeting.recording_id, meeting.title);
    startedAt.set(
      meeting.recording_id,
      meeting.recording_start_time ?? meeting.scheduled_start_time,
    );
    recorders.set(meeting.recording_id, meeting.recorded_by_name);
  }

  const withBrief = new Set(insights.map((row) => row.recording_id));
  const alerts: OperationalAlert[] = [];

  for (const row of failed) {
    alerts.push({
      id: `entrega-${row.id}`,
      kind: "entrega",
      severity: "critica",
      recordingId: row.recording_id,
      meetingTitle: titles.get(row.recording_id) ?? `Grabación ${String(row.recording_id)}`,
      occurredAt: row.sent_at ?? row.updated_at,
      quote: row.error,
      detail: `El resumen no llegó a ${row.channel}: el envío se reintentó ${plural(row.attempts, "vez", "veces")} y sigue sin publicarse.`,
      meta: `${row.channel} · ${plural(row.attempts, "intento", "intentos")}`,
      owner: recorders.get(row.recording_id) ?? null,
    });
  }

  for (const meeting of meetings) {
    if (withBrief.has(meeting.recording_id)) continue;
    alerts.push({
      id: `brief-${String(meeting.recording_id)}`,
      kind: "brief",
      severity: "alta",
      recordingId: meeting.recording_id,
      meetingTitle: meeting.title,
      occurredAt: meeting.recording_start_time ?? meeting.scheduled_start_time,
      quote: null,
      detail:
        "La grabación está archivada pero no tiene fila en meeting_insights: no hay resumen, ni decisiones, ni tono analizado.",
      meta: "Análisis de IA pendiente",
      owner: meeting.recorded_by_name,
    });
  }

  for (const item of open) {
    const owner = item.assignee_name?.trim() || item.assignee_email?.trim() || null;
    alerts.push({
      id: `compromiso-${item.id}`,
      kind: "compromiso",
      severity: "abierta",
      recordingId: item.recording_id,
      meetingTitle: titles.get(item.recording_id) ?? `Grabación ${String(item.recording_id)}`,
      occurredAt: startedAt.get(item.recording_id) ?? null,
      quote: item.description,
      detail: "Quedó recogido en la llamada y sigue marcado como no completado.",
      meta: owner ? `Asignado a ${owner}` : "Sin responsable asignado",
      owner,
    });
  }

  const objectionCutoff = now.getTime() - OBJECTION_WINDOW_DAYS * 86_400_000;

  for (const insight of insights) {
    const id = insight.recording_id;
    const title = titles.get(id) ?? `Grabación ${String(id)}`;
    const when = startedAt.get(id) ?? insight.created_at;
    const owner = recorders.get(id) ?? null;

    for (const [index, payment] of (parsePayments(insight.payments) ?? []).entries()) {
      if (payment.status !== "pendiente") continue;
      const amount =
        payment.amount === null ? "sin importe" : formatMoney(payment.amount, payment.currency);
      alerts.push({
        id: `pago-${String(id)}-${String(index)}`,
        kind: "pago",
        severity: "alta",
        recordingId: id,
        meetingTitle: title,
        occurredAt: when,
        quote: `${payment.concept} · ${amount}`,
        detail:
          "Se habló de este pago en la llamada y quedó como pendiente: confirma con el cliente si ya se ha cobrado.",
        meta: amount,
        owner,
      });
    }

    const score = parseScore(insight.call_score);
    if (score !== null && score < LOW_SCORE_THRESHOLD) {
      alerts.push({
        id: `puntuacion-${String(id)}`,
        kind: "puntuacion",
        severity: "alta",
        recordingId: id,
        meetingTitle: title,
        occurredAt: when,
        quote: null,
        detail: `La IA puntuó esta llamada con ${String(score)}/100 (umbral ${String(LOW_SCORE_THRESHOLD)}). Revisa el brief para ver qué falló.`,
        meta: `${String(score)}/100`,
        owner,
      });
    }

    const recent = timeOf(when) >= objectionCutoff;
    const unresolved = recent
      ? (parseObjections(insight.objections) ?? []).filter((item) => !item.resolved)
      : [];
    const first = unresolved[0];
    if (first) {
      const extra = unresolved.length - 1;
      alerts.push({
        id: `objecion-${String(id)}`,
        kind: "objecion",
        severity: "abierta",
        recordingId: id,
        meetingTitle: title,
        occurredAt: when,
        quote: extra > 0 ? `${first.objection} (y ${String(extra)} más)` : first.objection,
        detail: `El cliente planteó ${plural(unresolved.length, "objeción", "objeciones")} que no quedaron resueltas en la llamada (últimos ${String(OBJECTION_WINDOW_DAYS)} días).`,
        meta: plural(unresolved.length, "objeción abierta", "objeciones abiertas"),
        owner,
      });
    }
  }

  const counts: AlertCounts = {
    entrega: 0,
    brief: 0,
    pago: 0,
    puntuacion: 0,
    objecion: 0,
    compromiso: 0,
    total: alerts.length,
    bySeverity: { critica: 0, alta: 0, abierta: 0 },
  };
  for (const alert of alerts) {
    counts[alert.kind] += 1;
    counts.bySeverity[alert.severity] += 1;
  }

  alerts.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return timeOf(b.occurredAt) - timeOf(a.occurredAt);
  });

  return { alerts, counts };
}
