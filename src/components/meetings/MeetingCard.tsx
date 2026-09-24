import Link from "next/link";

import {
  formatDayMonth,
  formatDuration,
  formatSentiment,
  formatTime,
  initials,
  isoAttribute,
} from "@/components/formatting";
import { StatusBadge, type Tone } from "@/components/ui/primitives";
import type { MeetingSummary } from "@/lib/queries/meetings";

import styles from "./card.module.css";

const SENTIMENT_TONES: Record<string, Tone> = {
  positive: "ok",
  positivo: "ok",
  neutral: "neutral",
  neutro: "neutral",
  mixed: "warn",
  mixto: "warn",
  negative: "danger",
  negativo: "danger",
};

function sentimentTone(value: string | null): Tone {
  if (!value) return "neutral";
  return SENTIMENT_TONES[value.trim().toLowerCase()] ?? "neutral";
}

type MeetingCardProps = {
  meeting: MeetingSummary;
  /** Fila activa de la navegación con teclado. */
  active?: boolean;
};

/**
 * Ficha del archivo de llamadas. La miniatura abre la grabación en Fathom y el
 * titular abre el detalle; el resto de la fila es información, no acción.
 */
export function MeetingCard({ meeting, active }: MeetingCardProps) {
  const duration = formatDuration(meeting.startedAt, meeting.endedAt);
  const sentiment = formatSentiment(meeting.sentiment);
  const tone = sentimentTone(meeting.sentiment);
  const failed = meeting.deliveryStatus === "failed";

  const thumbInner = (
    <>
      <span className={styles.thumbPlay} aria-hidden="true">
        <svg viewBox="0 0 9 10" width="10" height="11" fill="currentColor">
          <path d="M0.5 0.5l7.5 4.5-7.5 4.5z" />
        </svg>
      </span>
      {duration ? <span className={`num ${styles.thumbTime}`}>{duration}</span> : null}
      {failed ? <span className={styles.thumbAlert} aria-hidden="true" /> : null}
    </>
  );

  return (
    <article
      className={styles.card}
      data-alert={failed ? "true" : undefined}
      data-active={active ? "true" : undefined}
    >
      {meeting.shareUrl ? (
        <a
          className={styles.thumb}
          href={meeting.shareUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Abrir la grabación de «${meeting.title}» en Fathom`}
        >
          {thumbInner}
        </a>
      ) : (
        <span className={styles.thumb} data-static="true">
          {thumbInner}
        </span>
      )}

      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>
            <Link href={`/meetings/${meeting.recordingId}`} className={styles.cardLink}>
              {meeting.title}
            </Link>
          </h3>
          <span className={styles.cardBrand}>{meeting.recordedByName ?? "Sin identificar"}</span>
          <span className={styles.cardSpacer} />
          <time className={`num ${styles.cardWhen}`} dateTime={isoAttribute(meeting.startedAt)}>
            {formatDayMonth(meeting.startedAt)}, {formatTime(meeting.startedAt)}
          </time>
        </div>

        {meeting.hasBrief ? (
          <p className={styles.cardSummary}>
            {meeting.headline ?? "El brief se generó sin titular."}
          </p>
        ) : (
          <p className={styles.cardPending}>Brief pendiente de generar.</p>
        )}

        <div className={styles.cardFoot}>
          <span className={styles.cardTone} data-tone={tone}>
            <span className={styles.cardToneDot} aria-hidden="true" />
            {sentiment ?? "Sin tono"}
          </span>

          {meeting.attendeesTotal > 0 ? (
            <span className={styles.cardMeta}>
              <span className="num">{meeting.attendeesTotal}</span> asistentes
              {meeting.attendeesExternal > 0 ? (
                <>
                  {" · "}
                  <span className="num">{meeting.attendeesExternal}</span> externos
                </>
              ) : null}
            </span>
          ) : null}

          {meeting.actionItemsTotal > 0 ? (
            <span
              className={styles.cardMeta}
              data-alert={meeting.actionItemsOpen > 0 ? "true" : undefined}
            >
              <span className="num">
                {meeting.actionItemsOpen}/{meeting.actionItemsTotal}
              </span>{" "}
              compromisos abiertos
            </span>
          ) : null}

          <span className={styles.cardSpacer} />

          <StatusBadge status={meeting.deliveryStatus} emptyLabel="Sin enviar" />

          <span className={styles.cardAvatar} aria-hidden="true">
            {initials(meeting.recordedByName, null)}
          </span>
        </div>
      </div>
    </article>
  );
}
