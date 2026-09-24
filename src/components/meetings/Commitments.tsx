import Link from "next/link";

import { formatDayMonth, isoAttribute } from "@/components/formatting";
import { EmptyState, SectionHead } from "@/components/ui/primitives";
import type { MeetingActionItem, OpenActionItem } from "@/lib/queries/meetings";

import styles from "./meetings.module.css";

type ActionItemListProps = {
  items: MeetingActionItem[];
};

function PlaybackLink({ item }: { item: MeetingActionItem }) {
  if (!item.playbackUrl || !item.timestamp) {
    return item.timestamp ? <span className={`num ${styles.stamp}`}>{item.timestamp}</span> : null;
  }

  return (
    <a
      className={`num ${styles.stampLink}`}
      href={item.playbackUrl}
      target="_blank"
      rel="noreferrer"
    >
      {item.timestamp}
      <span className="srOnly"> — abrir la grabación en ese minuto</span>
    </a>
  );
}

/** Compromisos de una reunión concreta. */
export function ActionItemList({ items }: ActionItemListProps) {
  const open = items.filter((item) => !item.completed);

  return (
    <section aria-labelledby="tareas" className={styles.panel}>
      <SectionHead
        id="tareas"
        title="Compromisos"
        count={items.length}
        action={
          items.length > 0 ? (
            <span className={styles.briefStamp}>{open.length} sin cerrar</span>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Sin compromisos registrados"
          body="Fathom no detectó tareas en esta llamada y nadie ha añadido ninguna a mano."
        />
      ) : (
        <ul className={styles.tasks}>
          {items.map((item) => (
            <li key={item.id} className={styles.task} data-done={item.completed || undefined}>
              <span className={styles.taskMark} aria-hidden="true" />
              <div className={styles.taskBody}>
                <p className={styles.taskText}>{item.description}</p>
                <p className={styles.taskMeta}>
                  {item.assigneeName || item.assigneeEmail ? (
                    <span>{item.assigneeName ?? item.assigneeEmail}</span>
                  ) : (
                    <span className={styles.taskUnassigned}>Sin responsable</span>
                  )}
                  {item.userGenerated ? <span>· añadida a mano</span> : null}
                  {item.completed ? <span>· completada</span> : null}
                </p>
              </div>
              <PlaybackLink item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type OpenActionItemListProps = {
  items: OpenActionItem[];
};

/** Vista de panel: compromisos abiertos de todas las reuniones. */
export function OpenActionItemList({ items }: OpenActionItemListProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nada pendiente"
        body="No hay compromisos abiertos con clientes ahora mismo."
      />
    );
  }

  return (
    <ul className={styles.openTasks}>
      {items.map((item) => (
        <li key={item.id} className={styles.openTask}>
          <p className={styles.taskText}>{item.description}</p>
          <p className={styles.openTaskMeta}>
            <Link href={`/meetings/${item.recordingId}`} className={styles.openTaskLink}>
              {item.meetingTitle}
            </Link>
            <time className="num" dateTime={isoAttribute(item.meetingStartedAt)}>
              {formatDayMonth(item.meetingStartedAt)}
            </time>
            {item.assigneeName ? <span>{item.assigneeName}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
