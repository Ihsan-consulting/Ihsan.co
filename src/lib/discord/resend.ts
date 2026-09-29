import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { TablesInsert } from "@/lib/types/database";
import { formatMoney } from "@/components/meetings/money";
import { toObjections, toPayments, toTextList } from "@/lib/queries/meetings";

import { sendDiscordBrief, type DiscordSendResult } from "./notify";

/** Mismo canal que usa el pipeline (`process.ts`), para que el reenvío actualice su fila. */
const CHANNEL = "discord";

export type ResendOutcome =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function recordDelivery(recordingId: number, outcome: DiscordSendResult): Promise<void> {
  const db = getAdminClient();
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

  const { error } = await db.from("deliveries").upsert(row, { onConflict: "recording_id,channel" });
  if (error) console.error("[discord-resend] deliveries upsert failed:", error.message);
}

/**
 * Reenvía a Discord el brief guardado de una llamada, con el enlace al Google Doc, y
 * deja constancia en `deliveries` igual que el pipeline.
 */
export async function resendMeetingToDiscord(recordingId: number): Promise<ResendOutcome> {
  const db = getAdminClient();

  const [meetingRes, insightRes] = await Promise.all([
    db
      .from("meetings")
      .select("title, share_url, google_doc_url")
      .eq("recording_id", recordingId)
      .maybeSingle(),
    db
      .from("meeting_insights")
      .select("*")
      .eq("recording_id", recordingId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (meetingRes.error || insightRes.error) {
    console.error("[discord-resend] read failed", {
      recordingId,
      message: meetingRes.error?.message ?? insightRes.error?.message,
    });
    return { ok: false, status: 500, error: "No se pudo leer la llamada." };
  }

  const meeting = meetingRes.data;
  if (!meeting) return { ok: false, status: 404, error: "La llamada no existe." };

  const insight = insightRes.data?.[0];
  if (!insight) {
    return { ok: false, status: 409, error: "Esta llamada todavía no tiene brief que enviar." };
  }

  const goals = toTextList(insight.goals);
  const objections = (toObjections(insight.objections) ?? []).map(
    (item) => `${item.resolved ? "✓" : "✗"} ${item.objection}`,
  );
  const payments = (toPayments(insight.payments) ?? []).map(
    (item) => `${item.concept}: ${formatMoney(item.amount, item.currency)} (${item.status})`,
  );

  const outcome = await sendDiscordBrief({
    title: meeting.title,
    shareUrl: meeting.share_url,
    headline: insight.headline ?? "Brief de la llamada",
    executiveSummary: insight.executive_summary ?? "",
    keyDecisions: toTextList(insight.key_decisions),
    risks: toTextList(insight.risks),
    nextSteps: toTextList(insight.next_steps),
    sentiment: insight.sentiment,
    docUrl: meeting.google_doc_url,
    extraSections: [
      { name: "Objetivos", items: goals },
      { name: "Objeciones", items: objections },
      { name: "Pagos", items: payments },
    ],
  });

  await recordDelivery(recordingId, outcome);

  if (!outcome.ok) {
    console.error("[discord-resend] send failed", { recordingId, error: outcome.error });
    return { ok: false, status: 502, error: "Discord rechazó el envío. Revisa el historial de entregas." };
  }
  return { ok: true };
}
