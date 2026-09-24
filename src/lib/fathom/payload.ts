import { z } from "zod";

/**
 * Shape of Fathom's `new-meeting-content-ready` webhook.
 *
 * Every object is loose and nearly every field is optional on purpose: Fathom only
 * sends the content blocks the webhook was registered for (transcript / summary /
 * action items / CRM matches are each opt-in), and an unexpected new field must never
 * cost us the whole payload. `recording_id` is the only thing we genuinely cannot work
 * without.
 */

const person = z.looseObject({
  name: z.string().nullish(),
  email: z.string().nullish(),
  team: z.string().nullish(),
});

const invitee = z.looseObject({
  name: z.string().nullish(),
  email: z.string().nullish(),
  is_external: z.boolean().nullish(),
});

const transcriptEntry = z.looseObject({
  speaker: z
    .looseObject({
      display_name: z.string().nullish(),
      matched_calendar_invitee_email: z.string().nullish(),
    })
    .nullish(),
  text: z.string().nullish(),
  timestamp: z.string().nullish(),
});

const actionItem = z.looseObject({
  description: z.string(),
  user_generated: z.boolean().nullish(),
  completed: z.boolean().nullish(),
  recording_timestamp: z.string().nullish(),
  recording_playback_url: z.string().nullish(),
  assignee: person.nullish(),
});

const crmMatches = z.looseObject({
  contacts: z.array(z.looseObject({})).nullish(),
  companies: z.array(z.looseObject({})).nullish(),
  deals: z.array(z.looseObject({})).nullish(),
});

export const fathomWebhookPayloadSchema = z.looseObject({
  id: z.string().nullish(),
  recording_id: z.coerce.number().int(),
  title: z.string().nullish(),
  meeting_url: z.string().nullish(),
  url: z.string().nullish(),
  created_at: z.string().nullish(),
  scheduled_start_time: z.string().nullish(),
  scheduled_end_time: z.string().nullish(),
  recording_start_time: z.string().nullish(),
  recording_end_time: z.string().nullish(),
  transcript_language: z.string().nullish(),
  calendar_invitees: z.array(invitee).nullish(),
  recorded_by: person.nullish(),
  transcript: z.array(transcriptEntry).nullish(),
  default_summary: z
    .looseObject({
      template_name: z.string().nullish(),
      markdown_formatted: z.string().nullish(),
    })
    .nullish(),
  action_items: z.array(actionItem).nullish(),
  crm_matches: crmMatches.nullish(),
  shared_with: z.string().nullish(),
});

export type FathomWebhookPayload = z.infer<typeof fathomWebhookPayloadSchema>;
export type FathomTranscriptEntry = z.infer<typeof transcriptEntry>;
export type FathomActionItem = z.infer<typeof actionItem>;

/** Fathom sends "HH:MM:SS" / ISO strings; anything unparseable becomes null rather than Invalid Date. */
export function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Flattens the speaker-segmented transcript into text an LLM can reason over. */
export function transcriptToPlainText(
  entries: FathomTranscriptEntry[] | null | undefined,
): string {
  if (!entries?.length) return "";
  return entries
    .map((entry) => {
      const who = entry.speaker?.display_name?.trim() || "Desconocido";
      const text = entry.text?.trim();
      return text ? `${who}: ${text}` : null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}
