import Link from "next/link";

import {
  formatDayMonth,
  formatDuration,
  formatTime,
  isoAttribute,
} from "@/components/formatting";
import { StatusBadge, Tag } from "@/components/ui/primitives";
import type { MeetingSummary } from "@/lib/queries/meetings";

import styles from "./meetings.module.css";

type MeetingCardProps = {
  meeting: MeetingSummary;
};

/**
 * Entrada de listado. La fecha ocupa un margen tipográfico a la izquierda y el
 * titular del brief es la línea que más pesa. Solo el titular recibe el foco,
 * para dejar una única parada de tabulación por reunión.
 */
export function MeetingCard({ meeting }: MeetingCardProps) {
  const duration = formatDuration(meeting.startedAt, meeting.endedAt);
  const href = `/meetings/${meeting.recordingId}`;

  return (
    <article className={styles.card} data-alert={meeting.deliveryStatus === "failed" || undefined}>
      <div className={styles.cardDate}>
        <time className="num" dateTime={isoAttribute(meeting.startedAt)}>
          {formatDayMonth(meeting.startedAt)}
        </time>
        <span className={`num ${styles.cardHour}`}>{formatTime(meeting.startedAt)}</span>
      </div>

      <div className={styles.cardBody}>
        <h3 className={styles.cardTitle}>
          <Link href={href} className={styles.cardLink}>
            {meeting.title}
          </Link>
        </h3>

        {meeting.headline ? (
          <p className={styles.cardHeadline}>{meeting.headline}</p>
        ) : (
          <p className={styles.cardPending}>Brief pendiente de generar</p>
        )}

        <ul className={styles.cardMeta}>
          {meeting.recordedByName ? (
            <li>
              Grabada por <strong>{meeting.recordedByName}</strong>
            </li>
          ) : null}
          {duration ? <li className="num">{duration}</li> : null}
          {meeting.attendeesTotal > 0 ? (
            <li className="num">
              {meeting.attendeesTotal} asistentes
              {meeting.attendeesExternal > 0 ? ` · ${meeting.attendeesExternal} externos` : ""}
            </li>
          ) : null}
        </ul>
      </div>

      <div className={styles.cardStatus}>
        <StatusBadge status={meeting.deliveryStatus} emptyLabel="Sin enviar" />
        {meeting.actionItemsTotal > 0 ? (
          <Tag tone={meeting.actionItemsOpen > 0 ? "accent" : "ok"}>
            {meeting.actionItemsOpen > 0
              ? `${meeting.actionItemsOpen}/${meeting.actionItemsTotal} tareas`
              : `${meeting.actionItemsTotal} tareas cerradas`}
          </Tag>
        ) : null}
      </div>
    </article>
  );
}
