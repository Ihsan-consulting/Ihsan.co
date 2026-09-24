import { getEnv } from "@/lib/env";

/** Hard caps enforced by Discord; exceeding any one of them fails the whole POST. */
export const DISCORD_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  total: 6000,
} as const;

const EMBED_COLOR = 0x2b8a78;

export type DiscordEmbedField = { name: string; value: string };

export type DiscordEmbed = {
  title: string;
  description: string;
  url?: string;
  color: number;
  fields: DiscordEmbedField[];
  footer?: { text: string };
};

export type DiscordBriefInput = {
  title: string;
  shareUrl?: string | null;
  headline: string;
  executiveSummary: string;
  keyDecisions: readonly string[];
  risks: readonly string[];
  nextSteps: readonly string[];
  sentiment?: string | null;
};

export type DiscordSendResult =
  | { ok: true; target: string }
  | { ok: false; target: string; error: string };

export function truncate(value: string, max: number): string {
  if (max <= 0) return "";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

/**
 * Drops markdown link syntax, keeping the label.
 *
 * The brief is model output derived from a meeting transcript, and a call participant can
 * dictate text designed to end up in it. Discord renders markdown links inside embeds, so
 * an unsanitised brief can hand the team a clickable phishing link that looks like it came
 * from our own automation. Keep the words, drop the destination.
 */
function sanitizeForEmbed(value: string): string {
  return value
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<(https?:\/\/[^>]*)>/g, "$1");
}

function bulletList(items: readonly string[]): string {
  return items
    .map((item) => sanitizeForEmbed(item).trim())
    .filter((item) => item.length > 0)
    .map((item) => `• ${item}`)
    .join("\n");
}

function toField(name: string, items: readonly string[]): DiscordEmbedField | null {
  const value = bulletList(items);
  if (!value) return null;
  return {
    name: truncate(name, DISCORD_LIMITS.fieldName),
    value: truncate(value, DISCORD_LIMITS.fieldValue),
  };
}

function embedLength(embed: DiscordEmbed): number {
  const fields = embed.fields.reduce(
    (total, field) => total + field.name.length + field.value.length,
    0,
  );
  return (
    embed.title.length +
    embed.description.length +
    fields +
    (embed.footer?.text.length ?? 0)
  );
}

/** Shrinks the description — the most expendable block — until the 6000 budget fits. */
function enforceTotal(embed: DiscordEmbed): DiscordEmbed {
  const overflow = embedLength(embed) - DISCORD_LIMITS.total;
  if (overflow <= 0) return embed;
  return {
    ...embed,
    description: truncate(embed.description, embed.description.length - overflow),
  };
}

export function buildMeetingEmbed(input: DiscordBriefInput): DiscordEmbed {
  const sentimentField: DiscordEmbedField | null = input.sentiment
    ? { name: "Sentimiento", value: truncate(input.sentiment, DISCORD_LIMITS.fieldValue) }
    : null;

  const fields = [
    toField("Decisiones clave", input.keyDecisions),
    toField("Riesgos", input.risks),
    toField("Próximos pasos", input.nextSteps),
    sentimentField,
  ].filter((field): field is DiscordEmbedField => field !== null);

  const embed: DiscordEmbed = {
    title: truncate(
      sanitizeForEmbed(`${input.title} — ${input.headline}`),
      DISCORD_LIMITS.title,
    ),
    description: truncate(
      sanitizeForEmbed(input.executiveSummary),
      DISCORD_LIMITS.description,
    ),
    color: EMBED_COLOR,
    fields: fields.slice(0, DISCORD_LIMITS.fields),
    footer: { text: "ihsan.co · brief generado automáticamente" },
    ...(input.shareUrl ? { url: input.shareUrl } : {}),
  };

  return enforceTotal(embed);
}

/**
 * A Discord webhook URL ends in a bearer-equivalent token. Only the token-less prefix is
 * ever stored in `deliveries.target` or written to a log.
 */
export function redactWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean).slice(0, -1);
    return `${parsed.origin}/${segments.join("/")}`;
  } catch {
    return "discord";
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

/** Never throws into the pipeline: every outcome comes back as a value. */
export async function sendDiscordBrief(
  input: DiscordBriefInput,
): Promise<DiscordSendResult> {
  let webhookUrl: string;
  try {
    webhookUrl = getEnv().DISCORD_DEFAULT_WEBHOOK_URL;
  } catch (error) {
    return {
      ok: false,
      target: "discord",
      error: `discord_not_configured: ${toMessage(error)}`,
    };
  }

  const target = redactWebhookUrl(webhookUrl);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Discord does not resolve mentions inside embeds today, so this changes nothing
      // right now — it is here so that moving any model-derived text into the top-level
      // `content` field later cannot turn a poisoned brief into an @everyone ping.
      body: JSON.stringify({
        embeds: [buildMeetingEmbed(input)],
        allowed_mentions: { parse: [] },
      }),
    });

    if (!response.ok) {
      return { ok: false, target, error: `discord_http_${response.status}` };
    }
    return { ok: true, target };
  } catch (error) {
    return { ok: false, target, error: `discord_request_failed: ${toMessage(error)}` };
  }
}
