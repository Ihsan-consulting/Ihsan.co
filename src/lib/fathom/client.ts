import "server-only";
import { getEnv } from "@/lib/env";
import { fathomWebhookPayloadSchema, type FathomWebhookPayload } from "@/lib/fathom/payload";

const BASE_URL = "https://api.fathom.ai/external/v1";

/**
 * Read side of the Fathom API, used to backfill recordings that finished before the
 * webhook existed. The webhook only ever fires for *new* content, so without this the
 * meetings already sitting in Fathom would never reach the dashboard.
 *
 * `GET /meetings` returns items shaped like the webhook payload, so they are validated
 * with the same schema and handed to the same `ingestMeeting` — one code path, not two.
 */

export type FathomPage = {
  meetings: FathomWebhookPayload[];
  skipped: number;
  nextCursor: string | null;
};

export type FathomListResult =
  | { ok: true; page: FathomPage }
  | { ok: false; reason: string };

type ListOptions = {
  cursor?: string | null;
  limit?: number;
};

export async function listFathomMeetings(
  options: ListOptions = {},
): Promise<FathomListResult> {
  const apiKey = getEnv().FATHOM_API_KEY;
  if (!apiKey) return { ok: false, reason: "fathom_api_key_missing" };

  const url = new URL(`${BASE_URL}/meetings`);
  url.searchParams.set("include_transcript", "true");
  url.searchParams.set("include_summary", "true");
  url.searchParams.set("include_action_items", "true");
  url.searchParams.set("limit", String(options.limit ?? 10));
  if (options.cursor) url.searchParams.set("cursor", options.cursor);

  let body: unknown;
  try {
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: `fathom_http_${response.status}` };
    body = await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return { ok: false, reason: `fathom_request_failed: ${message}` };
  }

  const envelope = body as { items?: unknown; next_cursor?: unknown };
  if (!Array.isArray(envelope.items)) {
    return { ok: false, reason: "fathom_unexpected_response" };
  }

  const meetings: FathomWebhookPayload[] = [];
  let skipped = 0;
  for (const item of envelope.items) {
    const parsed = fathomWebhookPayloadSchema.safeParse(item);
    // One malformed recording must not abort a backfill of the rest.
    if (parsed.success) meetings.push(parsed.data);
    else skipped += 1;
  }

  return {
    ok: true,
    page: {
      meetings,
      skipped,
      nextCursor: typeof envelope.next_cursor === "string" ? envelope.next_cursor : null,
    },
  };
}
