import { after } from "next/server";
import { listFathomMeetings } from "@/lib/fathom/client";
import { ingestMeeting } from "@/lib/pipeline/ingest";
import { processMeeting } from "@/lib/pipeline/process";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pages to walk in one run. 10 recordings per page is Fathom's default. */
const MAX_PAGES = 5;
/**
 * How many briefs to generate per run. Ingest is cheap; Gemini is not — it costs quota
 * and wall-clock, and the function has a duration budget. The rest stay ingested with no
 * brief and are picked up by the next run, which is safe because every write is an upsert.
 */
const MAX_BRIEFS_PER_RUN = 5;

/**
 * Backfills recordings that finished before the webhook was wired up.
 *
 * The webhook only fires for new content, so without this the meetings already sitting in
 * Fathom would never appear. Protected by the session gate: `/api/admin/*` is not in the
 * proxy's public allowlist, so an unauthenticated caller is redirected to /login and can
 * never reach this handler — which matters, because it spends Gemini quota.
 */
export async function POST(): Promise<Response> {
  let cursor: string | null = null;
  let fetched = 0;
  let ingested = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await listFathomMeetings({ cursor });
    if (!result.ok) {
      // A failure mid-walk still leaves earlier pages ingested; report rather than unwind.
      failures.push(result.reason);
      break;
    }

    fetched += result.page.meetings.length;
    skipped += result.page.skipped;

    for (const meeting of result.page.meetings) {
      const outcome = await ingestMeeting(meeting);
      if (outcome.ok) {
        ingested += 1;
      } else {
        failures.push(`recording ${meeting.recording_id}: ${outcome.error}`);
      }
    }

    cursor = result.page.nextCursor;
    if (!cursor) break;
  }

  // Pick what to summarise from the database, not from what this run happened to ingest.
  // Choosing the latter meant every re-run retried the same first few recordings forever:
  // it could never advance to the rest, and a transient Gemini 503 was unrecoverable.
  const db = getAdminClient();
  const [{ data: withBrief }, { data: allMeetings }] = await Promise.all([
    db.from("meeting_insights").select("recording_id"),
    db
      .from("meetings")
      .select("recording_id, google_doc_id")
      .order("recording_start_time", { ascending: false, nullsFirst: false }),
  ]);

  const done = new Set((withBrief ?? []).map((row) => row.recording_id));
  // A meeting still needs a pass if it has no brief OR no Drive document. Keying only on
  // the brief meant that once every brief existed the route became a no-op, and documents
  // could never be created for meetings summarised before Drive was configured.
  const pending = (allMeetings ?? [])
    .filter((row) => !done.has(row.recording_id) || row.google_doc_id === null)
    .map((row) => row.recording_id);

  const queued = pending.slice(0, MAX_BRIEFS_PER_RUN);
  if (queued.length > 0) {
    // Sequential on purpose: parallel Gemini calls trip the free-tier rate limit and the
    // whole batch fails instead of most of it succeeding.
    after(async () => {
      for (const recordingId of queued) {
        await processMeeting({ recordingId });
      }
    });
  }

  return Response.json({
    ok: failures.length === 0,
    fetched,
    ingested,
    skipped,
    briefs_queued: queued.length,
    briefs_pending: Math.max(0, pending.length - queued.length),
    more_pages: cursor !== null,
    failures,
  });
}
