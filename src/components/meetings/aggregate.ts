import { dayKey } from "@/components/formatting";
import type { MeetingSummary, OpenActionItem } from "@/lib/queries/meetings";

/**
 * Agregados del panel calculados sobre las filas que ya se han leído en servidor.
 * Nada de esto inventa cifras: si no hay grabaciones, todas las series son ceros y
 * los gráficos se dibujan planos, que es el estado real del panel.
 */

export const WEEKS = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type WeeklySeries = {
  meetings: number[];
  openItems: number[];
  withoutBrief: number[];
  failed: number[];
  tense: number[];
};

export type ToneSlice = {
  label: string;
  count: number;
  percent: number;
  tone: "ok" | "neutral" | "warn" | "danger";
};

export type TeamLoad = {
  name: string;
  meetings: number;
  openItems: number;
  failed: number;
};

function zeros(): number[] {
  return Array.from({ length: WEEKS }, () => 0);
}

/** Índice de semana (0 = la más antigua de la ventana, WEEKS-1 = esta semana). */
function weekIndex(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;

  const elapsed = now - time;
  if (elapsed < 0) return WEEKS - 1;

  const index = WEEKS - 1 - Math.floor(elapsed / WEEK_MS);
  return index >= 0 ? index : null;
}

/** Tono normalizado: el modelo puede devolverlo en inglés o en español. */
function normalizeSentiment(value: string | null): string {
  if (!value) return "unknown";
  const raw = value.trim().toLowerCase();
  if (raw === "positive" || raw === "positivo") return "positive";
  if (raw === "neutral" || raw === "neutro") return "neutral";
  if (raw === "negative" || raw === "negativo") return "negative";
  if (raw === "mixed" || raw === "mixto") return "mixed";
  return "unknown";
}

function isTense(sentiment: string | null): boolean {
  const normalized = normalizeSentiment(sentiment);
  return normalized === "negative" || normalized === "mixed";
}

export function weeklySeries(meetings: ReadonlyArray<MeetingSummary>): WeeklySeries {
  const now = Date.now();
  const series: WeeklySeries = {
    meetings: zeros(),
    openItems: zeros(),
    withoutBrief: zeros(),
    failed: zeros(),
    tense: zeros(),
  };

  for (const meeting of meetings) {
    const index = weekIndex(meeting.startedAt ?? meeting.createdAt, now);
    if (index === null) continue;

    series.meetings[index] += 1;
    series.openItems[index] += meeting.actionItemsOpen;
    if (!meeting.hasBrief) series.withoutBrief[index] += 1;
    if (meeting.deliveryStatus === "failed") series.failed[index] += 1;
    if (isTense(meeting.sentiment)) series.tense[index] += 1;
  }

  return series;
}

/** Diferencia entre la última semana y la anterior, ya formateada. */
export function weekTrend(series: ReadonlyArray<number>): string {
  const current = series[series.length - 1] ?? 0;
  const previous = series[series.length - 2] ?? 0;
  const delta = current - previous;
  if (delta === 0) return "=";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function sumSeries(series: ReadonlyArray<number>): number {
  return series.reduce((total, value) => total + value, 0);
}

export function todaysMeetings(meetings: ReadonlyArray<MeetingSummary>): MeetingSummary[] {
  const today = dayKey(new Date().toISOString());
  if (!today) return [];
  return meetings.filter((meeting) => dayKey(meeting.startedAt ?? meeting.createdAt) === today);
}

const TONE_ORDER: ReadonlyArray<{ key: string; label: string; tone: ToneSlice["tone"] }> = [
  { key: "positive", label: "Positivo", tone: "ok" },
  { key: "neutral", label: "Neutro", tone: "neutral" },
  { key: "mixed", label: "Mixto", tone: "warn" },
  { key: "negative", label: "Negativo", tone: "danger" },
  { key: "unknown", label: "Sin analizar", tone: "neutral" },
];

/** Reparto del tono detectado por el brief, con el mismo tratamiento de barras. */
export function toneBreakdown(meetings: ReadonlyArray<MeetingSummary>): ToneSlice[] {
  const counts = new Map<string, number>();
  for (const meeting of meetings) {
    const key = meeting.hasBrief ? normalizeSentiment(meeting.sentiment) : "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = meetings.length;

  return TONE_ORDER.map((entry) => {
    const count = counts.get(entry.key) ?? 0;
    return {
      label: entry.label,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
      tone: entry.tone,
    };
  });
}

/** Carga por persona que grabó, que es el único dato de equipo que llega del webhook. */
export function teamLoad(meetings: ReadonlyArray<MeetingSummary>): TeamLoad[] {
  const rows = new Map<string, TeamLoad>();

  for (const meeting of meetings) {
    const name = meeting.recordedByName?.trim() || "Sin identificar";
    const current = rows.get(name) ?? { name, meetings: 0, openItems: 0, failed: 0 };
    current.meetings += 1;
    current.openItems += meeting.actionItemsOpen;
    if (meeting.deliveryStatus === "failed") current.failed += 1;
    rows.set(name, current);
  }

  return Array.from(rows.values()).sort((a, b) => b.meetings - a.meetings);
}

/** Encabezados de grupo del archivo: Hoy, Ayer, Esta semana, Anteriores. */
export function dateGroup(iso: string | null): string {
  const today = dayKey(new Date().toISOString());
  const key = dayKey(iso);
  if (!key || !today) return "Sin fecha";
  if (key === today) return "Hoy";

  const yesterday = dayKey(new Date(Date.now() - DAY_MS).toISOString());
  if (key === yesterday) return "Ayer";

  const time = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isNaN(time) && Date.now() - time < WEEK_MS) return "Esta semana";
  return "Anteriores";
}

export function openItemKind(item: OpenActionItem): string {
  return item.assigneeName || item.assigneeEmail ? "Compromiso asignado" : "Compromiso sin dueño";
}
