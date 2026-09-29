"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import styles from "./insights.module.css";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

/** Reenvía el brief y el enlace al documento al canal de Discord del equipo. */
export function DiscordButton({ recordingId }: { recordingId: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  // Guarda contra el doble clic antes de que React pinte el estado deshabilitado.
  const inFlight = useRef(false);

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: "sending" });
    try {
      const response = await fetch(`/api/meetings/${recordingId}/discord`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (response.ok && body?.ok) {
        setState({ kind: "sent" });
        router.refresh();
      } else {
        setState({ kind: "error", message: body?.error ?? `Error ${response.status}` });
      }
    } catch {
      setState({ kind: "error", message: "Sin conexión. Inténtalo de nuevo." });
    } finally {
      inFlight.current = false;
    }
  }

  const label =
    state.kind === "sending"
      ? "Enviando a Discord…"
      : state.kind === "sent"
        ? "Enviado a Discord"
        : state.kind === "error"
          ? "Reintentar envío a Discord"
          : "Enviar a Discord";

  return (
    <div className={styles.discordWrap}>
      <button
        type="button"
        className={styles.discordButton}
        data-state={state.kind}
        onClick={send}
        disabled={state.kind === "sending"}
        aria-busy={state.kind === "sending"}
      >
        <span className={styles.discordLabel}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18.1a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.7zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
          </svg>
          {label}
        </span>
        <span aria-hidden="true">{state.kind === "sent" ? "✓" : "→"}</span>
      </button>
      <p className={styles.discordStatus} role="status" aria-live="polite">
        {state.kind === "error"
          ? state.message
          : state.kind === "sent"
            ? "Brief y documento publicados en el canal."
            : ""}
      </p>
    </div>
  );
}
