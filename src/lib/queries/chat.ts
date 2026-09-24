import "server-only";

import { getAdminClient } from "@/lib/supabase/admin";

import { unwrapCount } from "./meetings";

/**
 * Alcance del corpus. La pantalla de chat no tiene tabla propia —la conversación
 * vive en el bot de Discord, fuera de este repositorio—, así que lo único que puede
 * afirmar con datos es cuánto material hay indexado. Eso es lo que cuenta esto.
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
