import { initials } from "@/components/formatting";
import { EmptyState } from "@/components/ui/primitives";
import type { MeetingActionItem } from "@/lib/queries/meetings";

import { CommitmentToggle } from "./CommitmentToggle";
import styles from "./detail.module.css";

/**
 * Compromisos de una reunión. La casilla los cierra o reabre desde el panel; Fathom
 * puede cerrarlos también, pero nunca reabre uno cerrado aquí (ver `ingestMeeting`).
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
              <CommitmentToggle
                id={item.id}
                done={item.completed}
                variant="box"
                label={item.description}
              />

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
