import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

import { unwrap } from "./meetings";

/**
 * Métricas de negocio sacadas de las fichas de IA (`meeting_insights`): objeciones,
 * pagos, objetivos del cliente y puntuación de la llamada. Las cuatro columnas son
 * nuevas y valen NULL en las fichas antiguas hasta que se re-analicen: NULL significa
 * «sin analizar», nunca «cero».
 *
 * Dos lecturas en paralelo (fichas + reuniones) y todo lo demás se agrega en memoria.
 */

export type PaymentStatus = "acordado" | "pendiente" | "pagado" | "mencionado";

export const PAYMENT_STATUSES: ReadonlyArray<PaymentStatus> = [
  "pagado",
  "acordado",
  "pendiente",
  "mencionado",
];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pagado: "Pagado",
  acordado: "Acordado",
  pendiente: "Pendiente",
  mencionado: "Mencionado",
};

export type Objection = { objection: string; response: string | null; resolved: boolean };
export type Payment = {
  concept: string;
  amount: number | null;
  currency: string | null;
  status: PaymentStatus;
};

export type MeetingRef = { recordingId: number; title: string; startedAt: string | null };

export type InsightRowInput = {
  recording_id: number;
  created_at: string;
  call_score: number | null;
  objections: Json | null;
  payments: Json | null;
  goals: Json | null;
};

export type ObjectionGroup = {
  key: string;
  text: string;
  count: number;
  resolvedCount: number;
  resolvedPct: number;
  latest: MeetingRef;
  latestResponse: string | null;
};

export type PaymentTotal = {
  status: PaymentStatus;
  currency: string | null;
  total: number;
  count: number;
  /** Menciones sin importe: cuentan pero no suman. */
  withoutAmount: number;
};

export type PaymentEntry = Payment & { meeting: MeetingRef };
export type GoalEntry = { goal: string; meeting: MeetingRef };

export type ScoreStats = {
  average: number | null;
  scored: number;
  last7: number | null;
  prev7: number | null;
  /** Media semanal de las últimas 8 semanas (para la sparkline). */
  weekly: number[];
};

export type InsightsOverview = {
  analyzed: number;
  pendingAnalysis: number;
  objections: ObjectionGroup[];
  objectionsTotal: number;
  paymentTotals: PaymentTotal[];
  latestPayments: PaymentEntry[];
  /** Suma en EUR de lo acordado o pagado. Otras monedas no se convierten. */
  agreedEur: number;
  agreedOtherCurrencies: number;
  goals: GoalEntry[];
  score: ScoreStats;
};

/* --- Lectura defensiva de jsonb --------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > 0 ? text : null;
}

/** `null` = columna sin analizar; `[]` = analizada y sin objeciones. */
export function parseObjections(value: Json | null | undefined): Objection[] | null {
  if (!Array.isArray(value)) return null;
  const out: Objection[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const objection = cleanText(entry.objection);
    if (!objection) continue;
    out.push({
      objection,
      response: cleanText(entry.response),
      resolved: entry.resolved === true,
    });
  }
  return out;
}

const CURRENCY_ALIASES: Record<string, string> = {
  "€": "EUR",
  eur: "EUR",
  euro: "EUR",
  euros: "EUR",
  $: "USD",
  usd: "USD",
  dolar: "USD",
  dólar: "USD",
  dolares: "USD",
  dólares: "USD",
  "£": "GBP",
  gbp: "GBP",
};

export function normalizeCurrency(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const alias = CURRENCY_ALIASES[text.toLowerCase()];
  if (alias) return alias;
  return /^[a-z]{3}$/i.test(text) ? text.toUpperCase() : null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  return null;
}

export function parsePayments(value: Json | null | undefined): Payment[] | null {
  if (!Array.isArray(value)) return null;
  const out: Payment[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const concept = cleanText(entry.concept);
    const status = typeof entry.status === "string" ? entry.status.trim().toLowerCase() : "";
    if (!concept || !(PAYMENT_STATUSES as ReadonlyArray<string>).includes(status)) continue;
    out.push({
      concept,
      amount: parseAmount(entry.amount),
      currency: normalizeCurrency(entry.currency),
      status: status as PaymentStatus,
    });
  }
  return out;
}

export function parseGoals(value: Json | null | undefined): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const entry of value) {
    const text = cleanText(entry);
    if (text) out.push(text);
  }
  return out;
}

export function parseScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 100) return null;
  return Math.round(value);
}

/* --- Agregación pura ------------------------------------------------------- */

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const WEEKS = 8;

function timeOf(iso: string | null): number {
  if (!iso) return 0;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? 0 : value;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Clave de agrupado: minúsculas, sin acentos ni signos de puntuación. */
export function objectionKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:"'«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Options = { now?: Date; objectionLimit?: number; paymentLimit?: number; goalLimit?: number };

export function aggregateInsights(
  rows: ReadonlyArray<InsightRowInput>,
  meetings: ReadonlyMap<number, MeetingRef>,
  options: Options = {},
): InsightsOverview {
  const now = (options.now ?? new Date()).getTime();
  const objectionLimit = options.objectionLimit ?? 6;
  const paymentLimit = options.paymentLimit ?? 5;
  const goalLimit = options.goalLimit ?? 8;

  const refOf = (row: InsightRowInput): MeetingRef =>
    meetings.get(row.recording_id) ?? {
      recordingId: row.recording_id,
      title: `Grabación ${String(row.recording_id)}`,
      startedAt: row.created_at,
    };
  const whenOf = (row: InsightRowInput): number =>
    timeOf(meetings.get(row.recording_id)?.startedAt ?? null) || timeOf(row.created_at);

  // Lo más reciente primero: así «latest» y las listas cortas salen solas.
  const sorted = [...rows].sort((a, b) => whenOf(b) - whenOf(a));

  let analyzed = 0;
  let pendingAnalysis = 0;
  let objectionsTotal = 0;
  const groups = new Map<string, ObjectionGroup>();
  const totals = new Map<string, PaymentTotal>();
  const latestPayments: PaymentEntry[] = [];
  const goals: GoalEntry[] = [];
  const scores: number[] = [];
  const last7: number[] = [];
  const prev7: number[] = [];
  const weeklyBuckets: number[][] = Array.from({ length: WEEKS }, () => []);
  let agreedEur = 0;
  let agreedOtherCurrencies = 0;

  for (const row of sorted) {
    const objections = parseObjections(row.objections);
    const payments = parsePayments(row.payments);
    const rowGoals = parseGoals(row.goals);
    const score = parseScore(row.call_score);

    if (objections === null && payments === null && rowGoals === null && score === null) {
      pendingAnalysis += 1;
      continue;
    }
    analyzed += 1;
    const ref = refOf(row);

    for (const item of objections ?? []) {
      objectionsTotal += 1;
      const key = objectionKey(item.objection);
      if (!key) continue;
      const group = groups.get(key);
      if (group) {
        group.count += 1;
        if (item.resolved) group.resolvedCount += 1;
      } else {
        groups.set(key, {
          key,
          text: item.objection,
          count: 1,
          resolvedCount: item.resolved ? 1 : 0,
          resolvedPct: 0,
          latest: ref,
          latestResponse: item.response,
        });
      }
    }

    for (const payment of payments ?? []) {
      const totalKey = `${payment.status}|${payment.currency ?? ""}`;
      const entry = totals.get(totalKey) ?? {
        status: payment.status,
        currency: payment.currency,
        total: 0,
        count: 0,
        withoutAmount: 0,
      };
      entry.count += 1;
      if (payment.amount === null) entry.withoutAmount += 1;
      else entry.total += payment.amount;
      totals.set(totalKey, entry);

      const isAgreed = payment.status === "acordado" || payment.status === "pagado";
      if (isAgreed && payment.amount !== null) {
        if (payment.currency === "EUR") agreedEur += payment.amount;
        else agreedOtherCurrencies += 1;
      }
      if (latestPayments.length < paymentLimit) latestPayments.push({ ...payment, meeting: ref });
    }

    for (const goal of rowGoals ?? []) {
      if (goals.length < goalLimit) goals.push({ goal, meeting: ref });
    }

    if (score !== null) {
      scores.push(score);
      const age = now - whenOf(row);
      if (age >= 0 && age < WEEK_MS) last7.push(score);
      else if (age >= WEEK_MS && age < 2 * WEEK_MS) prev7.push(score);
      const week = Math.floor(age / WEEK_MS);
      if (age >= 0 && week < WEEKS) weeklyBuckets[WEEKS - 1 - week]?.push(score);
    }
  }

  const objectionGroups = [...groups.values()]
    .map((group) => ({
      ...group,
      resolvedPct: Math.round((group.resolvedCount / group.count) * 100),
    }))
    .sort((a, b) => b.count - a.count || timeOf(b.latest.startedAt) - timeOf(a.latest.startedAt))
    .slice(0, objectionLimit);

  const statusRank = (status: PaymentStatus) => PAYMENT_STATUSES.indexOf(status);
  const paymentTotals = [...totals.values()].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || b.total - a.total,
  );

  // Semanas sin puntuación repiten la última media conocida: nada de ceros falsos.
  let carry = 0;
  const weekly = weeklyBuckets.map((bucket) => {
    const avg = mean(bucket);
    if (avg !== null) carry = avg;
    return avg ?? carry;
  });

  return {
    analyzed,
    pendingAnalysis,
    objections: objectionGroups,
    objectionsTotal,
    paymentTotals,
    latestPayments,
    agreedEur,
    agreedOtherCurrencies,
    goals,
    score: {
      average: mean(scores),
      scored: scores.length,
      last7: mean(last7),
      prev7: mean(prev7),
      weekly,
    },
  };
}

/* --- Lectura --------------------------------------------------------------- */

export async function getInsightsOverview(): Promise<InsightsOverview> {
  const db = getAdminClient();

  const [insightRows, meetingRows] = await Promise.all([
    db
      .from("meeting_insights")
      .select("recording_id, created_at, call_score, objections, payments, goals"),
    db.from("meetings").select("recording_id, title, recording_start_time, scheduled_start_time"),
  ]);

  const insights = unwrap(insightRows, "las fichas de IA");
  const meetings = unwrap(meetingRows, "las reuniones");

  const refs = new Map<number, MeetingRef>();
  for (const meeting of meetings) {
    refs.set(meeting.recording_id, {
      recordingId: meeting.recording_id,
      title: meeting.title,
      startedAt: meeting.recording_start_time ?? meeting.scheduled_start_time,
    });
  }

  return aggregateInsights(insights, refs);
}

/* --- Formato --------------------------------------------------------------- */

const PLAIN = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

/** Importe en su moneda; sin moneda conocida, número desnudo (no inventamos el símbolo). */
export function formatMoney(amount: number, currency: string | null): string {
  if (!currency) return PLAIN.format(amount);
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${PLAIN.format(amount)} ${currency}`;
  }
}
