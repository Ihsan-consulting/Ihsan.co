import { reanalyzeMeeting } from "@/lib/pipeline/process";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Llamadas por ejecución: cada una es una petición al modelo. */
const BATCH = 8;
const CONCURRENCY = 4;

/**
 * Rellena objeciones, pagos, objetivos y puntuación en los briefs anteriores a esos campos
 * (`objections IS NULL`). Protegido por el proxy de sesión como el resto de `/api/admin/*`.
 * Se puede repetir hasta que `remaining` llegue a 0.
 */
export async function POST(): Promise<Response> {
  const db = getAdminClient();
  const pending = await db
    .from("meeting_insights")
    .select("recording_id")
    .is("objections", null)
    .order("created_at", { ascending: false })
    .limit(BATCH);

  if (pending.error) {
    return Response.json({ ok: false, error: pending.error.message }, { status: 500 });
  }

  const ids = pending.data.map((row) => row.recording_id);
  const failures: string[] = [];
  let done = 0;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const results = await Promise.all(ids.slice(i, i + CONCURRENCY).map(reanalyzeMeeting));
    results.forEach((result, index) => {
      if (result.ok) done += 1;
      else failures.push(`recording ${ids[i + index]}: ${result.error}`);
    });
  }

  const remaining = await db
    .from("meeting_insights")
    .select("id", { count: "exact", head: true })
    .is("objections", null);

  return Response.json({
    ok: failures.length === 0,
    reanalyzed: done,
    remaining: remaining.count ?? null,
    failures,
  });
}
