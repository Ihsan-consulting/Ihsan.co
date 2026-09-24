import { initials } from "@/components/formatting";
import { EmptyState } from "@/components/ui/primitives";
import type { MeetingActionItem } from "@/lib/queries/meetings";

import styles from "./detail.module.css";

/**
 * Compromisos de una reunión. Son de solo lectura: quien los cierra es Fathom,
 * no este panel, así que la marca es un indicador y no una casilla.
 */
export function ActionItemList({ items }: { items: MeetingActionItem[] }) {
  const open = items.filter((item) => !item.completed).length;

  return (
    <section aria-labelledby="tareas" className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 id="tareas" className={styles.panelTitle}>
          Próximos pasos
        </h2>
        <span className={`num ${styles.stamp}`}>
          {items.length === 0 ? "ninguno" : `${open} de ${items.length} sin cerrar`}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Sin compromisos registrados"
          body="Fathom no detectó tareas en esta llamada y nadie ha añadido ninguna a mano."
        />
      ) : (
        <ul className={styles.tasks}>
          {items.map((item) => (
            <li key={item.id} className={styles.task} data-done={item.completed || undefined}>
              <span className={styles.taskBox} aria-hidden="true">
                {item.completed ? (
                  <svg
                    viewBox="0 0 10 10"
                    width="9"
                    height="9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1.5 5.2L3.8 7.5L8.5 2.6" />
                  </svg>
                ) : null}
              </span>

              <span className={styles.taskBody}>
                <span className={styles.taskText}>{item.description}</span>
                <span className={styles.taskMeta}>
                  <span className={styles.taskAvatar} aria-hidden="true">
                    {initials(item.assigneeName, item.assigneeEmail)}
                  </span>
                  {item.assigneeName ?? item.assigneeEmail ?? "Sin responsable"}
                  {item.userGenerated ? " · añadida a mano" : ""}
                </span>
              </span>

              {item.playbackUrl && item.timestamp ? (
                <a
                  className={`num ${styles.taskStamp}`}
                  href={item.playbackUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.timestamp}
                  <span className="srOnly"> — abrir la grabación en ese minuto</span>
                </a>
              ) : item.timestamp ? (
                <span className={`num ${styles.taskStampFlat}`}>{item.timestamp}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
