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

/**
 * Log de envíos. El panel solo consulta las entregas con incidencia, así que las
 * publicaciones correctas se leen en el detalle de cada llamada, no aquí.
 */
export function DeliveryLog() {
  return (
    <p className={styles.logEmpty}>
      Aún no hay envíos registrados en esta vista. El panel solo vigila aquí las entregas con
      incidencia; el recorrido completo de cada publicación está en el detalle de su llamada.
    </p>
  );
}
