import type { MeetingActionItem, MeetingDelivery } from "@/lib/queries/meetings";

import styles from "./player.module.css";

/** `00:14:05` → 845 segundos. Devuelve `null` si el formato no es el esperado. */
function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

type RecordingPlayerProps = {
  shareUrl: string | null;
  durationLabel: string | null;
  totalSeconds: number | null;
  actionItems: ReadonlyArray<MeetingActionItem>;
};

/**
 * Superficie de la grabación. El panel no reproduce audio: la reproducción vive
 * en Fathom, así que la carátula y cada marca abren la grabación en el minuto
 * exacto que guardó el webhook.
 */
export function RecordingPlayer({
  shareUrl,
  durationLabel,
  totalSeconds,
  actionItems,
}: RecordingPlayerProps) {
  const markers = actionItems
    .map((item) => ({ item, seconds: parseTimestamp(item.timestamp) }))
    .filter(
      (entry): entry is { item: MeetingActionItem; seconds: number } =>
        entry.seconds !== null && entry.item.playbackUrl !== null,
    );

  return (
    <section aria-labelledby="grabacion" className={styles.player}>
      <h2 id="grabacion" className="srOnly">
        Grabación
      </h2>

      <div className={styles.playerStage}>
        {shareUrl ? (
          <a
            className={styles.playerButton}
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir la grabación en Fathom"
          >
            <svg viewBox="0 0 12 14" width="12" height="14" fill="currentColor" aria-hidden="true">
              <path d="M1 0.6l10 6.4-10 6.4z" />
            </svg>
          </a>
        ) : (
          <p className={styles.playerMissing}>Esta grabación no trae enlace público.</p>
        )}
      </div>

      <div className={styles.playerFoot}>
        <div className={styles.playerTrack}>
          {markers.map(({ item, seconds }) => {
            const left = totalSeconds && totalSeconds > 0 ? (seconds / totalSeconds) * 100 : null;
            if (left === null) return null;
            return (
              <a
                key={item.id}
                className={styles.playerMarker}
                style={{ left: `${Math.min(Math.max(left, 0), 100)}%` }}
                href={item.playbackUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                title={`${item.timestamp ?? ""} — ${item.description}`}
              >
                <span className="srOnly">
                  Abrir el minuto {item.timestamp} de la grabación: {item.description}
                </span>
              </a>
            );
          })}
        </div>

        <p className={styles.playerMeta}>
          <span className="num">00:00</span>
          <span className={styles.playerSpacer} />
          <span>Se reproduce en Fathom</span>
          <span className="num">{durationLabel ?? "—"}</span>
        </p>
      </div>

      {markers.length > 0 ? (
        <div className={styles.markerChips}>
          {markers.map(({ item }) => (
            <a
              key={`chip-${item.id}`}
              className={styles.markerChip}
              href={item.playbackUrl ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              Compromiso
              <span className="num">{item.timestamp}</span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

type SendChecklistProps = {
  hasTranscript: boolean;
  hasBrief: boolean;
  deliveries: ReadonlyArray<MeetingDelivery>;
};

/**
 * Recorrido real de la llamada por el pipeline. No hay ningún paso manual: el
 * envío lo dispara el webhook, así que aquí solo se comprueba.
 */
export function SendChecklist({ hasTranscript, hasBrief, deliveries }: SendChecklistProps) {
  const delivered = deliveries.some((delivery) => delivery.status === "sent");
  const failed = deliveries.some((delivery) => delivery.status === "failed");

  const steps = [
    {
      label: "Grabación recibida",
      hint: "Webhook de Fathom verificado y guardado en Supabase",
      done: true,
    },
    {
      label: "Transcripción guardada",
      hint: hasTranscript ? "Disponible para el análisis" : "El webhook no la incluyó",
      done: hasTranscript,
    },
    {
      label: "Brief en español generado",
      hint: hasBrief ? "Titular, resumen, decisiones y riesgos" : "Todavía sin resumen de IA",
      done: hasBrief,
    },
    {
      label: "Publicado en Discord",
      hint: failed
        ? "El último intento falló"
        : delivered
          ? "Entregado al canal"
          : "Sin publicar todavía",
      done: delivered,
    },
  ];

  const done = steps.filter((step) => step.done).length;
  const percent = Math.round((done / steps.length) * 100);

  return (
    <section
      aria-labelledby="checklist"
      className={styles.checklist}
      data-status={failed ? "failed" : delivered ? "sent" : "pending"}
    >
      <div className={styles.checklistHead}>
        <h2 id="checklist" className={styles.checklistTitle}>
          Recorrido de la llamada
        </h2>
        <span className={`num ${styles.checklistCount}`}>
          {done} de {steps.length}
        </span>
      </div>

      <div className={styles.checklistTrack}>
        <span className={styles.checklistFill} style={{ width: `${percent}%` }} />
      </div>

      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.label} className={styles.step} data-done={step.done ? "true" : undefined}>
            <span className={styles.stepBox} aria-hidden="true">
              {step.done ? (
                <svg
                  viewBox="0 0 10 10"
                  width="10"
                  height="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1.5 5.2L3.8 7.5L8.5 2.6" />
                </svg>
              ) : (
                <span className="num">{index + 1}</span>
              )}
            </span>
            <span className={styles.stepBody}>
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepHint}>{step.hint}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className={styles.checklistNote}>
        {failed
          ? "La publicación falló. El error completo está en el historial de entregas, aquí al lado."
          : "Todo el recorrido es automático: no hay ningún paso que dar a mano desde esta pantalla."}
      </p>
    </section>
  );
}
