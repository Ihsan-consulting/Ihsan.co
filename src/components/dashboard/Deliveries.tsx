import Link from "next/link";

import { formatRelative } from "@/components/formatting";
import type { ProblemDelivery } from "@/lib/queries/meetings";

import styles from "./dashboard.module.css";

/**
 * Cada grabación recorre tres pasos: se recibe, se genera el brief y se publica
 * en Discord. Una fila de entrega demuestra que los dos primeros ya ocurrieron,
 * así que la barra marca dos de tres mientras la publicación no se cierre.
 */
const TOTAL_STEPS = 3;
const DONE_STEPS = 2;

export function PendingDeliveries({ deliveries }: { deliveries: ReadonlyArray<ProblemDelivery> }) {
  if (deliveries.length === 0) {
    return (
      <p className={styles.emptyLine}>
        Nada en cola. Ninguna publicación a Discord está fallando ni esperando.
      </p>
    );
  }

  const percent = Math.round((DONE_STEPS / TOTAL_STEPS) * 100);

  return (
    <ul className={styles.sendList}>
      {deliveries.map((delivery) => (
        <li key={delivery.id} className={styles.sendRow}>
          <span className={styles.sendBody}>
            <span className={styles.sendTop}>
              <span className={styles.sendTitle}>{delivery.meetingTitle}</span>
              <span className={`num ${styles.sendLabel}`}>
                {DONE_STEPS} de {TOTAL_STEPS} pasos · {delivery.attempts} intento
                {delivery.attempts === 1 ? "" : "s"}
              </span>
            </span>
            <span className={styles.sendTrack}>
              <span
                className={styles.sendFill}
                data-status={delivery.status}
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className={styles.sendMeta}>
              <span data-status={delivery.status}>
                {delivery.status === "failed" ? "Publicación fallida" : "Esperando en cola"}
              </span>
              <span className={styles.sendSep} aria-hidden="true">
                ·
              </span>
              <span>{delivery.channel}</span>
              <span className={styles.sendSep} aria-hidden="true">
                ·
              </span>
              <span className="num">{formatRelative(delivery.updatedAt)}</span>
            </span>
            {delivery.error ? <span className={styles.sendError}>{delivery.error}</span> : null}
          </span>

          <Link
            href={`/meetings/${delivery.recordingId}`}
            className={styles.sendCta}
            data-status={delivery.status}
          >
            Revisar
          </Link>
        </li>
      ))}
    </ul>
  );
}

const LOG_STATUS_LABEL: Record<ProblemDelivery["status"], string> = {
  sent: "Publicado",
  pending: "En cola",
  failed: "Fallido",
};

/** Log de envíos: las últimas publicaciones, en cualquier estado. */
export function DeliveryLog({ deliveries }: { deliveries: ReadonlyArray<ProblemDelivery> }) {
  if (deliveries.length === 0) {
    return (
      <p className={styles.logEmpty}>
        Aún no se ha publicado nada. Cada brief que llegue a Discord aparecerá aquí.
      </p>
    );
  }

  return (
    <ul className={styles.logList}>
      {deliveries.map((delivery) => (
        <li key={delivery.id}>
          <Link href={`/meetings/${delivery.recordingId}`} className={styles.logRow}>
            <span className={styles.logDot} data-status={delivery.status} aria-hidden="true" />
            <span className={styles.logTitle}>{delivery.meetingTitle}</span>
            <span className={styles.logMeta}>
              <span data-status={delivery.status}>{LOG_STATUS_LABEL[delivery.status]}</span>
              <span className={styles.sendSep} aria-hidden="true">
                ·
              </span>
              <span className="num">{formatRelative(delivery.sentAt ?? delivery.updatedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
