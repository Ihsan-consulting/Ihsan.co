import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export type AdminClient = SupabaseClient<Database>;

let cached: AdminClient | undefined;

/**
 * Service-role client. Every table has RLS on with no policies, so this is the only
 * credential that can read or write them — which is why it must never reach the browser.
 * `server-only` turns an accidental client import into a build error.
 */
export function getAdminClient(): AdminClient {
  if (cached) return cached;

  const env = getEnv();
  cached = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return cached;
}
