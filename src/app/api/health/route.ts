import { getEnv } from "@/lib/env";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe. It proves the environment parses and that Supabase answers, and it
 * deliberately reports booleans only — never a variable name, value or driver message,
 * since this endpoint is reachable without authentication.
 */
export async function GET(): Promise<Response> {
  try {
    getEnv();
  } catch {
    console.error("health: environment validation failed");
    return Response.json(
      { ok: false, checks: { env: false, database: false } },
      { status: 503 },
    );
  }

  try {
    const { error } = await getAdminClient()
      .from("meetings")
      .select("recording_id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error(
      "health: database check failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return Response.json(
      { ok: false, checks: { env: true, database: false } },
      { status: 503 },
    );
  }

  return Response.json({ ok: true, checks: { env: true, database: true } });
}
