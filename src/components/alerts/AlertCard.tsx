import Link from "next/link";

import { formatDateTime, initials, isoAttribute } from "@/components/formatting";
import {
  ALERT_KIND_LABELS,
  ALERT_SEVERITY_LABELS,
  type OperationalAlert,
} from "@/lib/queries/alerts";

import styles from "./alerts.module.css";

/**
 * Tarjeta de alerta. La cita es texto de la propia fila —el error que devolvió el
 * proveedor o el compromiso tal cual se guardó— y se pinta siempre como texto.
 */
export function AlertCard({ alert }: { alert: OperationalAlert }) {
  return (
    <article className={styles.card} aria-labelledby={`alerta-${alert.id}`}>
      <div className={styles.body}>
        <div className={styles.top}>
          <span className={styles.severity} data-severity={alert.severity}>
            {ALERT_SEVERITY_LABELS[alert.severity]}
          </span>
          <span className={styles.kind}>{ALERT_KIND_LABELS[alert.kind]}</span>
          <span className={styles.spacer} aria-hidden="true" />
          <time className={`num ${styles.date}`} dateTime={isoAttribute(alert.occurredAt)}>
            {formatDateTime(alert.occurredAt)}
          </time>
        </div>

        <div className={styles.headline}>
          <h2 id={`alerta-${alert.id}`} className={styles.title}>
            {alert.meetingTitle}
          </h2>
          <span className={styles.meta}>{alert.meta}</span>
        </div>

        {alert.quote ? (
          <blockquote className={styles.quote}>
            <p className={styles.quoteText}>{alert.quote}</p>
            <p className={`num ${styles.quoteNote}`}>Grabación {alert.recordingId}</p>
          </blockquote>
        ) : (
          <p className={styles.quoteEmpty}>
            No hay nada que citar: esta alerta nace del estado de la grabación, no de algo que se
            dijera en la llamada.
          </p>
        )}

        <div className={styles.detail}>
          <p className={styles.detailTitle}>Qué implica</p>
          <p className={styles.detailText}>{alert.detail}</p>
        </div>
      </div>

      <div className={styles.foot}>
        <Link href={`/meetings/${String(alert.recordingId)}`} className={styles.action}>
          Abrir llamada
        </Link>
        <span className={styles.spacer} aria-hidden="true" />
        <span className={styles.owner}>
          Responsable
          <span className={styles.ownerName}>
            <span className={styles.ownerAvatar} aria-hidden="true">
              {initials(alert.owner, null)}
            </span>
            {alert.owner ?? "Sin asignar"}
          </span>
        </span>
      </div>
    </article>
  );
}
