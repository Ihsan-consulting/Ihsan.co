"use client";

import { useState } from "react";

import styles from "./backfill.module.css";

/**
 * Pulls recordings that finished before the webhook existed.
 *
 * The webhook only fires for new content, so without this the meetings already sitting in
 * Fathom never reach the dashboard. Safe to press repeatedly: every write upserts against
 * a unique constraint, and each run picks up the meetings that still have no brief.
 */

type Result = {
  ok: boolean;
  ingested: number;
  briefs_queued: number;
  briefs_pending: number;
  failures: string[];
};

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; result: Result }
  | { kind: "error"; message: string };

export function BackfillButton() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "running" });
    try {
      const response = await fetch("/api/admin/backfill", { method: "POST" });
      if (!response.ok) {
        setState({ kind: "error", message: `El servidor respondió ${response.status}.` });
        return;
      }
      setState({ kind: "done", result: (await response.json()) as Result });
    } catch {
      setState({ kind: "error", message: "No se pudo conectar con el servidor." });
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={run}
        disabled={state.kind === "running"}
      >
        {state.kind === "running" ? "Buscando en Fathom…" : "Traer grabaciones de Fathom"}
      </button>

      {state.kind === "done" ? (
        <p className={styles.note} role="status">
          {state.result.ingested} guardadas · {state.result.briefs_queued} resúmenes en marcha
          {state.result.briefs_pending > 0
            ? ` · ${state.result.briefs_pending} pendientes, vuelve a pulsar`
            : null}
          {state.result.failures.length > 0
            ? ` · ${state.result.failures.length} con error`
            : null}
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p className={`${styles.note} ${styles.noteError}`} role="alert">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
