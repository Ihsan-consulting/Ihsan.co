import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

import { unwrapCount } from "./meetings";

/**
 * Alcance del corpus: cuánto material hay indexado para poder responder. El chat
 * no tiene tabla propia —la conversación vive en el estado del componente y no se
 * guarda—, así que esto es lo único que la pantalla puede afirmar con datos.
 */

export type CorpusScope = {
  meetings: number;
  withTranscript: number;
  openCommitments: number;
  briefs: number;
};

export async function getCorpusScope(): Promise<CorpusScope> {
  const db = getAdminClient();

  const [meetings, withTranscript, openCommitments, briefs] = await Promise.all([
    db.from("meetings").select("recording_id", { count: "exact", head: true }),
    db
      .from("meetings")
      .select("recording_id", { count: "exact", head: true })
      .not("transcript", "is", null),
    db.from("action_items").select("id", { count: "exact", head: true }).eq("completed", false),
    db.from("meeting_insights").select("id", { count: "exact", head: true }),
  ]);

  return {
    meetings: unwrapCount(meetings, "las reuniones"),
    withTranscript: unwrapCount(withTranscript, "las transcripciones"),
    openCommitments: unwrapCount(openCommitments, "los compromisos abiertos"),
    briefs: unwrapCount(briefs, "los briefs"),
  };
}
