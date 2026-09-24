import Link from "next/link";

import {
  formatDayMonth,
  formatDuration,
  formatSentiment,
  formatTime,
  initials,
  isoAttribute,
} from "@/components/formatting";
import { openItemKind } from "@/components/meetings/aggregate";
import type { MeetingSummary, OpenActionItem } from "@/lib/queries/meetings";

import styles from "./queue.module.css";

/** Cola de decisiones: los compromisos abiertos de todas las reuniones. */
export function DecisionQueue({ items }: { items: ReadonlyArray<OpenActionItem> }) {
  if (items.length === 0) {
    return (
      <div className={styles.queueEmpty}>
        <p className={styles.queueEmptyTitle}>Todo resuelto.</p>
        <p className={styles.queueEmptyText}>Sin compromisos abiertos con cliente ahora mismo.</p>
      </div>
    );
  }

  return (
    <ol className={styles.queue}>
      {items.map((item, index) => {
        const unowned = !item.assigneeName && !item.assigneeEmail;

        return (
          <li key={item.id} className={styles.queueItem}>
            <span className={`num ${styles.queueNum}`}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.queueBody}>
              <div className={styles.queueHead}>
                <span className={styles.queueKind} data-unowned={unowned ? "true" : undefined}>
                  <span className={styles.queueDot} aria-hidden="true" />
                  {openItemKind(item)}
                </span>
                <Link href={`/meetings/${item.recordingId}`} className={styles.queueTitle}>
                  {item.meetingTitle}
                </Link>
                <time
                  className={`num ${styles.queueSub}`}
                  dateTime={isoAttribute(item.meetingStartedAt)}
                >
                  {formatDayMonth(item.meetingStartedAt)}
                </time>
              </div>

              <p className={styles.queueText}>{item.description}</p>

              <div className={styles.queueActions}>
                <Link href={`/meetings/${item.recordingId}`} className={styles.queueCta}>
                  Abrir llamada
                </Link>
                {item.playbackUrl && item.timestamp ? (
                  <a
                    className={styles.queueGhost}
                    href={item.playbackUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver el minuto <span className="num">{item.timestamp}</span>
                  </a>
                ) : null}
                <span className={styles.queueSpacer} />
                <span className={styles.queueOwner}>
                  {item.assigneeName ?? item.assigneeEmail ?? "Sin responsable"}
                </span>
                <span className={styles.queueAvatar} aria-hidden="true">
                  {initials(item.assigneeName, item.assigneeEmail)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Llamadas de hoy. Las que aún no tienen brief se muestran en análisis. */
export function TodayList({ meetings }: { meetings: ReadonlyArray<MeetingSummary> }) {
  if (meetings.length === 0) {
    return <p className={styles.todayEmpty}>Todavía no hay llamadas hoy.</p>;
  }

  return (
    <ul className={styles.today}>
      {meetings.map((meeting) => {
        const duration = formatDuration(meeting.startedAt, meeting.endedAt);
        const sentiment = formatSentiment(meeting.sentiment);

        return (
          <li key={meeting.recordingId}>
            <Link href={`/meetings/${meeting.recordingId}`} className={styles.todayRow}>
              <span
                className={styles.todayGlyph}
                data-processing={meeting.hasBrief ? undefined : "true"}
                aria-hidden="true"
              >
                {meeting.hasBrief ? (
                  <svg viewBox="0 0 9 10" width="10" height="11" fill="currentColor">
                    <path d="M0.5 0.5l7.5 4.5-7.5 4.5z" />
                  </svg>
                ) : null}
              </span>
              <span className={styles.todayBody}>
                <span className={styles.todayTop}>
                  <span className={styles.todayTitle}>{meeting.title}</span>
                  <time
                    className={`num ${styles.todayHour}`}
                    dateTime={isoAttribute(meeting.startedAt)}
                  >
                    {formatTime(meeting.startedAt)}
                  </time>
                </span>
                {meeting.hasBrief ? (
                  <span className={styles.todayLine}>
                    {meeting.headline ?? "Brief generado sin titular."}
                  </span>
                ) : (
                  <span className={styles.todayShimmer} aria-hidden="true" />
                )}
                <span className={styles.todayMeta}>
                  {meeting.hasBrief ? (
                    <span className={styles.todayTone}>{sentiment ?? "Sin tono"}</span>
                  ) : (
                    <span className={styles.todayAnalyzing}>
                      <span className={styles.todayPulse} aria-hidden="true" />
                      Analizando
                    </span>
                  )}
                  <span className={styles.todaySep} aria-hidden="true">
                    ·
                  </span>
                  <span>{meeting.recordedByName ?? "Sin identificar"}</span>
                  {duration ? (
                    <>
                      <span className={styles.todaySep} aria-hidden="true">
                        ·
                      </span>
                      <span className="num">{duration}</span>
                    </>
                  ) : null}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
