/**
 * Formato para España: locale `es-ES`, zona horaria `Europe/Madrid`.
 * La zona se fija explícitamente para que el servidor (UTC en Vercel) y el
 * navegador produzcan exactamente la misma cadena.
 */

const LOCALE = "es-ES";
const TIME_ZONE = "Europe/Madrid";

const dayMonth = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

const dayMonthYear = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const longDate = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const clock = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDayMonth(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? dayMonth.format(date) : "—";
}

export function formatLongDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? longDate.format(date) : "Sin fecha";
}

export function formatTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? clock.format(date) : "—";
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "Sin fecha";
  return `${dayMonthYear.format(date)}, ${clock.format(date)}`;
}

/** Valor para el atributo `dateTime` de `<time>`; `undefined` si la fecha no es válida. */
export function isoAttribute(iso: string | null | undefined): string | undefined {
  return parse(iso) ? iso ?? undefined : undefined;
}

export function formatRelative(iso: string | null | undefined): string {
  const date = parse(iso);
  if (!date) return "";

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (Math.abs(diffDays) >= 30) {
    return relative.format(Math.round(diffDays / 30), "month");
  }
  if (Math.abs(diffDays) >= 1) {
    return relative.format(diffDays, "day");
  }

  const diffHours = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(diffHours) >= 1) {
    return relative.format(diffHours, "hour");
  }
  return relative.format(Math.round(diffMs / (60 * 1000)), "minute");
}

export function formatDuration(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string | null {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start || !end) return null;

  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const LANGUAGE_NAMES = new Intl.DisplayNames([LOCALE], { type: "language" });

export function formatLanguage(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

export function initials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "··";
  const words = source.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "··";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positivo",
  positivo: "Positivo",
  neutral: "Neutro",
  neutro: "Neutro",
  negative: "Negativo",
  negativo: "Negativo",
  mixed: "Mixto",
  mixto: "Mixto",
};

export function formatSentiment(value: string | null | undefined): string | null {
  if (!value) return null;
  return SENTIMENT_LABELS[value.trim().toLowerCase()] ?? value;
}
